-- 1. Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_code VARCHAR(32) NOT NULL,
    category VARCHAR(100) NOT NULL,
    class_name VARCHAR(50) NOT NULL,
    lesson_date DATE NOT NULL,
    duration VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    max_students INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Student Sequence and Table
CREATE SEQUENCE IF NOT EXISTS student_id_seq START 1;

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_code VARCHAR(32) UNIQUE NOT NULL DEFAULT ('S' || LPAD(nextval('student_id_seq')::TEXT, 10, '0')),
    chinese_name VARCHAR(100) NOT NULL,
    english_name VARCHAR(100),
    school VARCHAR(150),
    gender VARCHAR(10) CHECK (gender IN ('男', '女')),
    phone VARCHAR(32) NOT NULL,
    class_code VARCHAR(32) NOT NULL,
    receipt_url TEXT,
    payment_status VARCHAR(10) DEFAULT 'no' CHECK (payment_status IN ('yes', 'no')),
    reminder_status VARCHAR(10) DEFAULT 'no' CHECK (reminder_status IN ('yes', 'no')),
    attendance_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_per_class UNIQUE (chinese_name, phone, class_code)
);

CREATE INDEX IF NOT EXISTS idx_class_date ON classes(lesson_date);
CREATE INDEX IF NOT EXISTS idx_student_class_code ON students(class_code);
