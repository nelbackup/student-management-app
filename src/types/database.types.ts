export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      classes: {
        Row: {
          id: string;
          class_code: string;
          category: string;
          class_name: string;
          lesson_date: string;
          duration: string;
          description: string;
          max_students: number;
          created_at: string;
        };
      };
      students: {
        Row: {
          id: string;
          student_code: string;
          chinese_name: string;
          english_name: string | null;
          school: string | null;
          gender: '男' | '女';
          phone: string;
          class_code: string;
          receipt_url: string | null;
          payment_status: 'yes' | 'no';
          reminder_status: 'yes' | 'no';
          attendance_status: boolean;
          created_at: string;
        };
      };
    };
  };
}
