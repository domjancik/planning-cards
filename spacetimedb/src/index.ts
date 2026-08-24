import { schema, table, t, SenderError, type InferSchema, type ReducerCtx } from 'spacetimedb/server';

const validCards = new Set(['1', '3', '5', '8', '13', 'infinite']);

const room = table(
  { name: 'room', public: true },
  {
    roomId: t.string().primaryKey(),
    phase: t.string(),
    phaseVersion: t.u64(),
    resetVersion: t.u64(),
    updatedAt: t.timestamp(),
  }
);

const participant = table(
  { name: 'participant', public: true },
  {
    id: t.string().primaryKey(),
    roomId: t.string().index('btree'),
    participantId: t.string(),
    name: t.string(),
    ready: t.bool(),
    hasSelection: t.bool(),
    connected: t.bool(),
    updatedAt: t.timestamp(),
  }
);

const vote = table(
  { name: 'vote' },
  {
    id: t.string().primaryKey(),
    roomId: t.string().index('btree'),
    participantId: t.string(),
    selectedValue: t.string(),
    updatedAt: t.timestamp(),
  }
);

const revealed_vote = table(
  { name: 'revealed_vote', public: true },
  {
    id: t.string().primaryKey(),
    roomId: t.string().index('btree'),
    participantId: t.string(),
    selectedValue: t.string(),
    phaseVersion: t.u64(),
    updatedAt: t.timestamp(),
  }
);

const participant_connection = table(
  { name: 'participant_connection' },
  {
    connectionId: t.connectionId().primaryKey(),
    id: t.string().index('btree'),
    roomId: t.string(),
    participantId: t.string(),
  }
);

const spacetimedb = schema({
  room,
  participant,
  vote,
  revealed_vote,
  participant_connection,
});

export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

function normalizeRoomId(roomId: string): string {
  const normalized = roomId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  if (!normalized) {
    throw new SenderError('room_id_required');
  }
  return normalized;
}

function normalizeParticipantId(participantId: string): string {
  const normalized = participantId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
  if (!normalized) {
    throw new SenderError('participant_id_required');
  }
  return normalized;
}

function normalizeName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ').slice(0, 32);
  return normalized || 'Guest';
}

function normalizeCardValue(value: string): string {
  if (!validCards.has(value)) {
    throw new SenderError('invalid_card');
  }
  return value;
}

function participantKey(roomId: string, participantId: string): string {
  return `${roomId}:${participantId}`;
}

function ensureRoom(ctx: Ctx, roomId: string) {
  const existing = ctx.db.room.roomId.find(roomId);
  if (existing) {
    return existing;
  }

  return ctx.db.room.insert({
    roomId,
    phase: 'voting',
    phaseVersion: 0n,
    resetVersion: 0n,
    updatedAt: ctx.timestamp,
  });
}

function setRoomPhase(ctx: Ctx, roomId: string, phase: 'voting' | 'revealed') {
  const existing = ensureRoom(ctx, roomId);
  const next = {
    ...existing,
    phase,
    phaseVersion: existing.phaseVersion + 1n,
    updatedAt: ctx.timestamp,
  };
  ctx.db.room.roomId.update(next);
  return next;
}

function ensureParticipant(ctx: Ctx, roomId: string, participantId: string, name = 'Guest') {
  const id = participantKey(roomId, participantId);
  const existing = ctx.db.participant.id.find(id);

  if (existing) {
    const next = {
      ...existing,
      name: normalizeName(name || existing.name),
      connected: true,
      updatedAt: ctx.timestamp,
    };
    ctx.db.participant.id.update(next);
    return next;
  }

  return ctx.db.participant.insert({
    id,
    roomId,
    participantId,
    name: normalizeName(name),
    ready: false,
    hasSelection: false,
    connected: true,
    updatedAt: ctx.timestamp,
  });
}

function rememberConnection(ctx: Ctx, roomId: string, participantId: string) {
  if (!ctx.connectionId) {
    return;
  }

  const id = participantKey(roomId, participantId);
  const existing = ctx.db.participant_connection.connectionId.find(ctx.connectionId);
  const next = {
    connectionId: ctx.connectionId,
    id,
    roomId,
    participantId,
  };

  if (existing) {
    ctx.db.participant_connection.connectionId.update(next);
  } else {
    ctx.db.participant_connection.insert(next);
  }
}

function upsertRevealedVote(ctx: Ctx, roomId: string, participantId: string, selectedValue: string, phaseVersion: bigint) {
  const id = participantKey(roomId, participantId);
  const existing = ctx.db.revealed_vote.id.find(id);
  const next = {
    id,
    roomId,
    participantId,
    selectedValue,
    phaseVersion,
    updatedAt: ctx.timestamp,
  };

  if (existing) {
    ctx.db.revealed_vote.id.update(next);
  } else {
    ctx.db.revealed_vote.insert(next);
  }
}

function deleteRevealedVotes(ctx: Ctx, roomId: string) {
  for (const revealed of [...ctx.db.revealed_vote.roomId.filter(roomId)]) {
    ctx.db.revealed_vote.id.delete(revealed.id);
  }
}

export const init = spacetimedb.init(_ctx => {});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  if (!ctx.connectionId) {
    return;
  }

  const connection = ctx.db.participant_connection.connectionId.find(ctx.connectionId);
  if (!connection) {
    return;
  }

  ctx.db.participant_connection.connectionId.delete(ctx.connectionId);

  const hasAnotherConnection = [...ctx.db.participant_connection.id.filter(connection.id)].some(
    active => active.connectionId !== ctx.connectionId
  );

  if (!hasAnotherConnection) {
    const existing = ctx.db.participant.id.find(connection.id);
    if (existing) {
      ctx.db.participant.id.update({
        ...existing,
        connected: false,
        updatedAt: ctx.timestamp,
      });
    }
  }
});

export const joinRoom = spacetimedb.reducer(
  { roomId: t.string(), participantId: t.string(), name: t.string() },
  (ctx, args) => {
    const roomId = normalizeRoomId(args.roomId);
    const participantId = normalizeParticipantId(args.participantId);
    ensureRoom(ctx, roomId);
    ensureParticipant(ctx, roomId, participantId, args.name);
    rememberConnection(ctx, roomId, participantId);
  }
);

export const setName = spacetimedb.reducer(
  { roomId: t.string(), participantId: t.string(), name: t.string() },
  (ctx, args) => {
    const roomId = normalizeRoomId(args.roomId);
    const participantId = normalizeParticipantId(args.participantId);
    ensureRoom(ctx, roomId);
    ensureParticipant(ctx, roomId, participantId, args.name);
    rememberConnection(ctx, roomId, participantId);
  }
);

export const setReady = spacetimedb.reducer(
  { roomId: t.string(), participantId: t.string(), ready: t.bool(), name: t.string() },
  (ctx, args) => {
    const roomId = normalizeRoomId(args.roomId);
    const participantId = normalizeParticipantId(args.participantId);
    const current = ensureParticipant(ctx, roomId, participantId, args.name);
    ctx.db.participant.id.update({
      ...current,
      ready: args.ready,
      updatedAt: ctx.timestamp,
    });
    rememberConnection(ctx, roomId, participantId);
  }
);

export const selectCard = spacetimedb.reducer(
  { roomId: t.string(), participantId: t.string(), selectedValue: t.string(), name: t.string() },
  (ctx, args) => {
    const roomId = normalizeRoomId(args.roomId);
    const participantId = normalizeParticipantId(args.participantId);
    const selectedValue = normalizeCardValue(args.selectedValue);
    const room = ensureRoom(ctx, roomId);
    const current = ensureParticipant(ctx, roomId, participantId, args.name);
    const id = participantKey(roomId, participantId);
    const existingVote = ctx.db.vote.id.find(id);
    const nextVote = {
      id,
      roomId,
      participantId,
      selectedValue,
      updatedAt: ctx.timestamp,
    };

    if (existingVote) {
      ctx.db.vote.id.update(nextVote);
    } else {
      ctx.db.vote.insert(nextVote);
    }

    ctx.db.participant.id.update({
      ...current,
      hasSelection: true,
      updatedAt: ctx.timestamp,
    });

    if (room.phase === 'revealed') {
      upsertRevealedVote(ctx, roomId, participantId, selectedValue, room.phaseVersion);
    }

    rememberConnection(ctx, roomId, participantId);
  }
);

export const revealRoom = spacetimedb.reducer(
  { roomId: t.string() },
  (ctx, args) => {
    const roomId = normalizeRoomId(args.roomId);
    const room = setRoomPhase(ctx, roomId, 'revealed');
    deleteRevealedVotes(ctx, roomId);

    for (const currentVote of [...ctx.db.vote.roomId.filter(roomId)]) {
      upsertRevealedVote(
        ctx,
        roomId,
        currentVote.participantId,
        currentVote.selectedValue,
        room.phaseVersion
      );
    }
  }
);

export const hideRoom = spacetimedb.reducer(
  { roomId: t.string() },
  (ctx, args) => {
    const roomId = normalizeRoomId(args.roomId);
    setRoomPhase(ctx, roomId, 'voting');
    deleteRevealedVotes(ctx, roomId);
  }
);

export const resetRoom = spacetimedb.reducer(
  { roomId: t.string() },
  (ctx, args) => {
    const roomId = normalizeRoomId(args.roomId);
    const room = setRoomPhase(ctx, roomId, 'voting');
    ctx.db.room.roomId.update({
      ...room,
      resetVersion: room.resetVersion + 1n,
      updatedAt: ctx.timestamp,
    });
    deleteRevealedVotes(ctx, roomId);

    for (const currentVote of [...ctx.db.vote.roomId.filter(roomId)]) {
      ctx.db.vote.id.delete(currentVote.id);
    }

    for (const currentParticipant of [...ctx.db.participant.roomId.filter(roomId)]) {
      ctx.db.participant.id.update({
        ...currentParticipant,
        ready: false,
        hasSelection: false,
        updatedAt: ctx.timestamp,
      });
    }
  }
);
