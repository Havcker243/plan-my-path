-- ============================================================================
-- Seed ALL Fisk University majors into the majors table
-- Run this in your Supabase SQL Editor
-- CSCI is already seeded by complete_requirements_setup.sql — skipped here
-- All other majors are inserted without full requirement groups yet, so students
-- can select them during onboarding. Requirements pages will show empty for them.
-- ============================================================================

INSERT INTO majors (code, name, degree_type, total_credits_required, description)
VALUES
  ('ACC',  'Accounting',                    'B.S.',   120, 'Bachelor of Science in Accounting'),
  ('ART',  'Art',                           'B.F.A.', 120, 'Bachelor of Fine Arts in Art'),
  ('BIOL', 'Biology',                       'B.S.',   120, 'Bachelor of Science in Biology'),
  ('BAD',  'Business Administration',       'B.S.',   120, 'Bachelor of Science in Business Administration'),
  ('CHEM', 'Chemistry',                     'B.S.',   120, 'Bachelor of Science in Chemistry'),
  ('CRJ',  'Criminal Justice',              'B.S.',   120, 'Bachelor of Science in Criminal Justice'),
  ('DSCI', 'Data Science',                  'B.S.',   120, 'Bachelor of Science in Data Science'),
  ('ECON', 'Economics',                     'B.S.',   120, 'Bachelor of Science in Economics'),
  ('EDUC', 'Education',                     'B.S.',   120, 'Bachelor of Science in Education'),
  ('ENG',  'English',                       'B.A.',   120, 'Bachelor of Arts in English'),
  ('FIN',  'Finance',                       'B.S.',   120, 'Bachelor of Science in Finance'),
  ('FLM',  'Film',                          'B.F.A.', 120, 'Bachelor of Fine Arts in Film'),
  ('FREN', 'French',                        'B.A.',   120, 'Bachelor of Arts in French'),
  ('GRD',  'Graphic Design',               'B.F.A.', 120, 'Bachelor of Fine Arts in Graphic Design'),
  ('HCA',  'Healthcare Administration',     'B.S.',   120, 'Bachelor of Science in Healthcare Administration'),
  ('HIS',  'History',                       'B.A.',   120, 'Bachelor of Arts in History'),
  ('IND',  'Interior Design',              'B.F.A.', 120, 'Bachelor of Fine Arts in Interior Design'),
  ('KINS', 'Kinesiology',                  'B.S.',   120, 'Bachelor of Science in Kinesiology'),
  ('MGT',  'Management',                   'B.S.',   120, 'Bachelor of Science in Management'),
  ('MKT',  'Marketing',                    'B.S.',   120, 'Bachelor of Science in Marketing'),
  ('MATH', 'Mathematics',                  'B.S.',   120, 'Bachelor of Science in Mathematics'),
  ('MUS',  'Music',                        'B.M.',   120, 'Bachelor of Music'),
  ('PHR',  'Philosophy & Religious Studies','B.A.',   120, 'Bachelor of Arts in Philosophy and Religious Studies'),
  ('PHO',  'Photography',                  'B.F.A.', 120, 'Bachelor of Fine Arts in Photography'),
  ('PHYS', 'Physics',                      'B.S.',   120, 'Bachelor of Science in Physics'),
  ('PSCI', 'Political Science',            'B.A.',   120, 'Bachelor of Arts in Political Science'),
  ('PSY',  'Psychology',                   'B.S.',   120, 'Bachelor of Science in Psychology'),
  ('SOJ',  'Social Justice',               'B.A.',   120, 'Bachelor of Arts in Social Justice'),
  ('SW',   'Social Work',                  'B.S.W.', 120, 'Bachelor of Social Work'),
  ('SOC',  'Sociology',                    'B.S.',   120, 'Bachelor of Science in Sociology'),
  ('SPAN', 'Spanish',                      'B.A.',   120, 'Bachelor of Arts in Spanish')
ON CONFLICT (code) DO UPDATE
  SET name                   = EXCLUDED.name,
      degree_type            = EXCLUDED.degree_type,
      total_credits_required = EXCLUDED.total_credits_required,
      description            = EXCLUDED.description,
      updated_at             = NOW();
