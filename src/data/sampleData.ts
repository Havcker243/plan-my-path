import { Course, Major, Semester, PlannedCourse, CourseSection } from '@/types/planner';

// Sample CS Major Course Data
export const csCourses: Course[] = [
  // Core Courses - Year 1
  {
    id: 'cs-101',
    code: 'CS-101',
    title: 'Introduction to Computer Science',
    credits: 3,
    description: 'Fundamental concepts of programming and computational thinking.',
    prerequisites: [],
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Core',
  },
  {
    id: 'cs-102',
    code: 'CS-102',
    title: 'Programming Fundamentals',
    credits: 4,
    description: 'Object-oriented programming concepts with practical applications.',
    prerequisites: ['CS-101'],
    prereqExpression: 'CS-101',
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Core',
  },
  {
    id: 'math-101',
    code: 'MATH-101',
    title: 'Calculus I',
    credits: 4,
    description: 'Limits, derivatives, and integrals of single-variable functions.',
    prerequisites: [],
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Math',
  },
  {
    id: 'math-102',
    code: 'MATH-102',
    title: 'Calculus II',
    credits: 4,
    description: 'Integration techniques, sequences, and series.',
    prerequisites: ['MATH-101'],
    prereqExpression: 'MATH-101',
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Math',
  },
  // Core Courses - Year 2
  {
    id: 'cs-201',
    code: 'CS-201',
    title: 'Data Structures',
    credits: 3,
    description: 'Arrays, linked lists, trees, graphs, and algorithm analysis.',
    prerequisites: ['CS-102'],
    prereqExpression: 'CS-102',
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Core',
  },
  {
    id: 'cs-202',
    code: 'CS-202',
    title: 'Algorithms',
    credits: 3,
    description: 'Algorithm design, analysis, and complexity theory.',
    prerequisites: ['CS-201', 'MATH-102'],
    prereqExpression: 'CS-201 AND MATH-102',
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Core',
  },
  {
    id: 'cs-210',
    code: 'CS-210',
    title: 'Computer Organization',
    credits: 3,
    description: 'Digital logic, assembly language, and computer architecture.',
    prerequisites: ['CS-102'],
    prereqExpression: 'CS-102',
    offeredTerms: ['fall'],
    type: 'core',
    requirementBucket: 'Systems',
  },
  {
    id: 'math-201',
    code: 'MATH-201',
    title: 'Discrete Mathematics',
    credits: 3,
    description: 'Logic, sets, relations, functions, and graph theory.',
    prerequisites: ['MATH-101'],
    prereqExpression: 'MATH-101',
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Math',
  },
  // Core Courses - Year 3
  {
    id: 'cs-301',
    code: 'CS-301',
    title: 'Operating Systems',
    credits: 3,
    description: 'Process management, memory management, and file systems.',
    prerequisites: ['CS-210'],
    prereqExpression: 'CS-210',
    offeredTerms: ['fall'],
    type: 'core',
    requirementBucket: 'Systems',
  },
  {
    id: 'cs-302',
    code: 'CS-302',
    title: 'Database Systems',
    credits: 3,
    description: 'Relational databases, SQL, and database design.',
    prerequisites: ['CS-201'],
    prereqExpression: 'CS-201',
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Core',
  },
  {
    id: 'cs-310',
    code: 'CS-310',
    title: 'Software Engineering',
    credits: 3,
    description: 'Software development methodologies and project management.',
    prerequisites: ['CS-201'],
    prereqExpression: 'CS-201',
    offeredTerms: ['spring'],
    type: 'core',
    requirementBucket: 'Core',
  },
  {
    id: 'cs-320',
    code: 'CS-320',
    title: 'Computer Networks',
    credits: 3,
    description: 'Network protocols, architecture, and security fundamentals.',
    prerequisites: ['CS-210'],
    prereqExpression: 'CS-210',
    offeredTerms: ['spring'],
    type: 'core',
    requirementBucket: 'Systems',
  },
  // Core Courses - Year 4
  {
    id: 'cs-401',
    code: 'CS-401',
    title: 'Senior Capstone Project',
    credits: 4,
    description: 'Team-based software development project.',
    prerequisites: ['CS-310'],
    prereqExpression: 'CS-310',
    offeredTerms: ['fall', 'spring'],
    type: 'core',
    requirementBucket: 'Capstone',
  },
  // Electives
  {
    id: 'cs-350',
    code: 'CS-350',
    title: 'Artificial Intelligence',
    credits: 3,
    description: 'Search algorithms, machine learning, and neural networks.',
    prerequisites: ['CS-202'],
    prereqExpression: 'CS-202',
    offeredTerms: ['fall'],
    type: 'elective',
    requirementBucket: 'Elective',
  },
  {
    id: 'cs-360',
    code: 'CS-360',
    title: 'Web Development',
    credits: 3,
    description: 'Full-stack web development with modern frameworks.',
    prerequisites: ['CS-201'],
    prereqExpression: 'CS-201',
    offeredTerms: ['fall', 'spring'],
    type: 'elective',
    requirementBucket: 'Elective',
  },
  {
    id: 'cs-370',
    code: 'CS-370',
    title: 'Mobile App Development',
    credits: 3,
    description: 'iOS and Android application development.',
    prerequisites: ['CS-201'],
    prereqExpression: 'CS-201',
    offeredTerms: ['spring'],
    type: 'elective',
    requirementBucket: 'Elective',
  },
  {
    id: 'cs-380',
    code: 'CS-380',
    title: 'Cybersecurity',
    credits: 3,
    description: 'Security principles, cryptography, and ethical hacking.',
    prerequisites: ['CS-320'],
    prereqExpression: 'CS-320',
    offeredTerms: ['fall', 'spring'],
    type: 'elective',
    requirementBucket: 'Elective',
  },
  {
    id: 'cs-390',
    code: 'CS-390',
    title: 'Cloud Computing',
    credits: 3,
    description: 'Distributed systems, virtualization, and cloud services.',
    prerequisites: ['CS-301'],
    prereqExpression: 'CS-301',
    offeredTerms: ['spring'],
    type: 'elective',
    requirementBucket: 'Elective',
  },
  // General Education
  {
    id: 'eng-101',
    code: 'ENG-101',
    title: 'College Writing',
    credits: 3,
    description: 'Academic writing and critical thinking skills.',
    prerequisites: [],
    offeredTerms: ['fall', 'spring'],
    type: 'general',
    requirementBucket: 'General Education',
  },
  {
    id: 'comm-101',
    code: 'COMM-101',
    title: 'Public Speaking',
    credits: 3,
    description: 'Oral communication and presentation skills.',
    prerequisites: [],
    offeredTerms: ['fall', 'spring'],
    type: 'general',
    requirementBucket: 'General Education',
  },
];

export const csMajor: Major = {
  id: 'cs',
  name: 'Computer Science',
  catalogYear: '2024-2025',
  requiredCredits: 120,
  coreCredits: 45,
  electiveCredits: 12,
  courses: csCourses,
};

// Sample sections for demo
export const sampleSections: CourseSection[] = [
  {
    id: 'cs201-001',
    courseId: 'cs-201',
    sectionNumber: '001',
    professor: 'Dr. Sarah Chen',
    seatsTotal: 35,
    seatsOpen: 8,
    meetingTimes: 'MWF 9:00-9:50 AM',
  },
  {
    id: 'cs201-002',
    courseId: 'cs-201',
    sectionNumber: '002',
    professor: 'Dr. Michael Park',
    seatsTotal: 35,
    seatsOpen: 2,
    meetingTimes: 'TR 10:30 AM-11:45 AM',
  },
  {
    id: 'cs201-003',
    courseId: 'cs-201',
    sectionNumber: '003',
    professor: 'Dr. Sarah Chen',
    seatsTotal: 30,
    seatsOpen: 15,
    meetingTimes: 'MWF 2:00-2:50 PM',
  },
];

// Generate a sample 4-year plan
export function generateSamplePlan(admittedYear: number = 2024): Semester[] {
  const semesters: Semester[] = [];
  const yearLabels = ['Y1', 'Y2', 'Y3', 'Y4'];
  
  for (let i = 0; i < 4; i++) {
    const year = admittedYear + i;
    const yearLabel = yearLabels[i];
    
    // Fall semester
    semesters.push({
      id: `fall-${year}`,
      type: 'fall',
      year,
      label: `Fall ${yearLabel}`,
      courses: [],
      maxCredits: 18,
    });
    
    // Spring semester
    semesters.push({
      id: `spring-${year + 1}`,
      type: 'spring',
      year: year + 1,
      label: `Spring ${yearLabel}`,
      courses: [],
      maxCredits: 18,
    });
  }
  
  // Populate with sample courses
  const courseAssignments: Record<string, string[]> = {
    'fall-2024': ['cs-101', 'math-101', 'eng-101'],
    'spring-2025': ['cs-102', 'math-102', 'comm-101'],
    'fall-2025': ['cs-201', 'cs-210', 'math-201'],
    'spring-2026': ['cs-202', 'cs-302', 'cs-360'],
    'fall-2026': ['cs-301', 'cs-310', 'cs-350'],
    'spring-2027': ['cs-320', 'cs-370', 'cs-380'],
    'fall-2027': ['cs-401', 'cs-390'],
    'spring-2028': [],
  };
  
  semesters.forEach(semester => {
    const courseIds = courseAssignments[semester.id] || [];
    semester.courses = courseIds.map(courseId => {
      const course = csCourses.find(c => c.id === courseId)!;
      return {
        ...course,
        status: 'planned',
        semesterId: semester.id,
        moodScore: Math.random() > 0.3 ? Math.floor(Math.random() * 3) : undefined,
        moodCount: Math.floor(Math.random() * 50) + 5,
      };
    });
  });
  
  return semesters;
}

// Sample completed courses for demo
export const sampleCompletedCourses: PlannedCourse[] = [
  {
    ...csCourses[0], // CS-101
    status: 'completed',
    grade: 'A',
    gradePoints: 4.0,
    semesterId: 'fall-2024',
  },
  {
    ...csCourses[2], // MATH-101
    status: 'completed',
    grade: 'B+',
    gradePoints: 3.3,
    semesterId: 'fall-2024',
  },
  {
    ...csCourses[18], // ENG-101
    status: 'completed',
    grade: 'A-',
    gradePoints: 3.7,
    semesterId: 'fall-2024',
  },
];
