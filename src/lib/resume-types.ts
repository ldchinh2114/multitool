export interface ResumeData {
  profile: {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    linkedin: string;
    facebook: string;
    summary: string;
  };
  work: WorkExperience[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  skills: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  date: string;
  link: string;
  description: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate: string;
  credentialId: string;
  credentialUrl: string;
  description: string;
}

export const initialResumeData: ResumeData = {
  profile: {
    name: 'Type your full name',
    title: 'Type your job title',
    email: 'Type your email',
    phone: 'Type your phone number',
    location: 'Type your location',
    website: 'Type your website URL',
    linkedin: 'Type your LinkedIn URL',
    facebook: 'Type your Facebook URL',
    summary: 'Type your professional summary here. Write about your experience, skills, and career goals...',
  },
  work: [
    {
      id: '1',
      company: 'Type company name',
      position: 'Type your position',
      startDate: 'Start date',
      endDate: 'End date',
      description: 'Type your job responsibilities and achievements. Describe your role, projects, and accomplishments...',
    },
  ],
  projects: [
    {
      id: '1',
      name: 'Type project name',
      date: 'Date/Period',
      link: 'Type project link',
      description: 'Type project description. Describe what you built, technologies used, and your role...',
    },
  ],
  education: [
    {
      id: '1',
      school: 'Type school/university name',
      degree: 'Type your degree',
      startDate: 'Start date',
      endDate: 'End date',
    },
  ],
  certifications: [],
  skills: 'Type your skill 1, Type your skill 2, Type your skill 3',
};