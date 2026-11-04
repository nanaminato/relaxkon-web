
export interface GenerateTask{
  task_id?: string;
  task_type?: string;
  date?: Date | string;
  account_id: number;
  images?: string[] | null;
  videos?: string[] | null;
}

