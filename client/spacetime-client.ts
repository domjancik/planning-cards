import * as PlanningCardsSpacetime from './module_bindings';

declare global {
  interface Window {
    PlanningCardsSpacetime?: typeof PlanningCardsSpacetime;
  }
}

window.PlanningCardsSpacetime = PlanningCardsSpacetime;
