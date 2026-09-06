export interface ActionState {
  error: string | null;
  successCount: number;
}

export const initialActionState: ActionState = { error: null, successCount: 0 };
