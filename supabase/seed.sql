INSERT INTO classes (class_code, category, class_name, lesson_date, duration, description) VALUES
('C00001', '考小實戰遊戲班', 'Class A', '2026-09-13', '15:00 - 16:00', '9月6日 及 9月13日 (星期日) 15:00 - 16:00'),
('C00002', '考小實戰遊戲班', 'Class B', '2026-09-13', '16:15 - 17:15', '9月6日 及 9月13日 (星期日) 16:15 - 17:15');

INSERT INTO students (chinese_name, english_name, school, gender, phone, class_code, receipt_url, payment_status) VALUES
('吳芊曈', 'Ng Chin Tung Sonia', 'Learning Habitat', '女', '60925440', 'C00001', 'https://drive.google.com', 'no'),
('鍾皓政', 'Chung Ho Ching', 'Cat & Dog Kindergarten', '男', '92070084', 'C00001', 'https://drive.google.com', 'yes');
