'use client';

import { useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import {
  User,
  Briefcase,
  Code,
  GraduationCap,
  Sparkles,
  Plus,
  Trash2,
  Download,
  Trophy,
  Award,
  File,
  Save,
  Clock,
  FolderOpen,
  Edit3,
  ChevronLeft,
  X,
  Globe,
} from 'lucide-react';
import { ResumeData, WorkExperience, Project, Education, Certification, Language, Draft, initialResumeData, ProficiencyLevel } from '@/lib/resume-types';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/language-context';

// Register Be Vietnam Pro font for Vietnamese support
Font.register({
  family: 'Be Vietnam Pro',
  fonts: [
    {
      src: '/font/BeVietnamPro-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: '/font/BeVietnamPro-Bold.ttf',
      fontWeight: 700,
    },
  ],
});

// Disable hyphenation to prevent words like "proficient" from being split with "-"
Font.registerHyphenationCallback((word: string) => [word]);

type TabType = 'profile' | 'work' | 'projects' | 'education' | 'certifications' | 'languages' | 'skills' | 'strengths';

const STORAGE_KEY = 'resume-builder-data';
const STRENGTHS_STORAGE_KEY = 'resume-builder-strengths';
const TIMESTAMP_KEY = 'resume-builder-timestamp';
const DRAFTS_STORAGE_KEY = 'resume-builder-drafts';
const CURRENT_DRAFT_ID_KEY = 'resume-builder-current-draft-id';
const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const DRAFT_EXPIRY_DAYS = 7;
const DRAFT_EXPIRY_MS = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export default function ResumeBuilder() {
  const { t, language, setLanguage } = useLanguage();
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [strengths, setStrengths] = useState<string>(
    'Type your strength 1, Type your strength 2, Type your strength 3, Type your strength 4'
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showDraftList, setShowDraftList] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [countdown, setCountdown] = useState<{ [key: string]: string }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [toastDraftTitle, setToastDraftTitle] = useState('');
  const [saveToastTimeout, setSaveToastTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentEditingTitle, setCurrentEditingTitle] = useState('');

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedTimestamp = localStorage.getItem(TIMESTAMP_KEY);
      const currentTime = Date.now();

      // Check if data has expired (older than 1 hour)
      if (savedTimestamp) {
        const timestamp = parseInt(savedTimestamp, 10);
        if (currentTime - timestamp > ONE_HOUR_MS) {
          // Data has expired, clear it
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STRENGTHS_STORAGE_KEY);
          localStorage.removeItem(TIMESTAMP_KEY);
          setIsLoaded(true);
          return;
        }
      }

      const savedData = localStorage.getItem(STORAGE_KEY);
      const savedStrengths = localStorage.getItem(STRENGTHS_STORAGE_KEY);
      const savedCurrentDraftId = localStorage.getItem(CURRENT_DRAFT_ID_KEY);

      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setResumeData(parsedData);
      }

      if (savedStrengths) {
        setStrengths(savedStrengths);
      }

      // Restore current draft ID if it exists
      if (savedCurrentDraftId) {
        setCurrentDraftId(savedCurrentDraftId);
      }
    } catch (error) {
      console.error('Error loading resume data from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Load drafts from localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const savedDrafts = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (savedDrafts) {
        const parsedDrafts: Draft[] = JSON.parse(savedDrafts);
        const now = Date.now();
        const validDrafts = parsedDrafts.filter(draft => draft.expiresAt > now);
        if (validDrafts.length !== parsedDrafts.length) {
          localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(validDrafts));
        }
        setDrafts(validDrafts);
      }
    } catch (error) {
      console.error('Error loading drafts from localStorage:', error);
    }
  }, [isLoaded]);

  // Save drafts to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('Error saving drafts to localStorage:', error);
    }
  }, [drafts, isLoaded]);

  // Save current draft ID to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (currentDraftId) {
        localStorage.setItem(CURRENT_DRAFT_ID_KEY, currentDraftId);
      } else {
        localStorage.removeItem(CURRENT_DRAFT_ID_KEY);
      }
    } catch (error) {
      console.error('Error saving current draft ID:', error);
    }
  }, [currentDraftId, isLoaded]);

  // Countdown timer for draft expiry
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const newCountdown: { [key: string]: string } = {};
      const validDrafts: Draft[] = [];
      
      drafts.forEach(draft => {
        if (draft.expiresAt > now) {
          const diff = draft.expiresAt - now;
          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
          const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
          
          if (days > 0) {
            newCountdown[draft.id] = `${days}d ${hours}h`;
          } else if (hours > 0) {
            newCountdown[draft.id] = `${hours}h ${minutes}m`;
          } else {
            newCountdown[draft.id] = `${minutes}m`;
          }
          validDrafts.push(draft);
        }
      });
      
      setCountdown(newCountdown);
      if (validDrafts.length !== drafts.length) {
        setDrafts(validDrafts);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [drafts]);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resumeData));
      localStorage.setItem(STRENGTHS_STORAGE_KEY, strengths);
      localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error saving resume data to localStorage:', error);
    }
  }, [resumeData, strengths, isLoaded]);

  const updateProfile = (field: keyof ResumeData['profile'], value: string) => {
    setResumeData((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value },
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const addWorkExperience = () => {
    const newWork: WorkExperience = {
      id: Date.now().toString(),
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      description: '',
    };
    setResumeData((prev) => ({
      ...prev,
      work: [...prev.work, newWork],
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const updateWorkExperience = (id: string, field: keyof WorkExperience, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      work: prev.work.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const deleteWorkExperience = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      work: prev.work.filter((item) => item.id !== id),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const addProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: '',
      date: '',
      link: '',
      description: '',
    };
    setResumeData((prev) => ({
      ...prev,
      projects: [...prev.projects, newProject],
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const updateProject = (id: string, field: keyof Project, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      projects: prev.projects.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const deleteProject = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      projects: prev.projects.filter((item) => item.id !== id),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const addEducation = () => {
    const newEducation: Education = {
      id: Date.now().toString(),
      school: '',
      degree: '',
      startDate: '',
      endDate: '',
      gpa: '',
      academicRank: '',
    };
    setResumeData((prev) => ({
      ...prev,
      education: [...prev.education, newEducation],
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      education: prev.education.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const deleteEducation = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      education: prev.education.filter((item) => item.id !== id),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const addCertification = () => {
    const newCertification: Certification = {
      id: Date.now().toString(),
      name: '',
      issuer: '',
      issueDate: '',
      expirationDate: '',
      credentialId: '',
      credentialUrl: '',
      description: '',
    };
    setResumeData((prev) => ({
      ...prev,
      certifications: [...prev.certifications, newCertification],
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const updateCertification = (id: string, field: keyof Certification, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      certifications: prev.certifications.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const deleteCertification = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((item) => item.id !== id),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const addLanguage = () => {
    const newLanguage: Language = {
      id: Date.now().toString(),
      name: '',
      proficiency: 'Intermediate',
    };
    setResumeData((prev) => ({
      ...prev,
      languages: [...prev.languages, newLanguage],
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const updateLanguage = (id: string, field: keyof Language, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      languages: prev.languages.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const deleteLanguage = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      languages: prev.languages.filter((item) => item.id !== id),
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const handleStrengthsChange = (value: string) => {
    setStrengths(value);
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const handleSkillsChange = (value: string) => {
    setResumeData((prev) => ({
      ...prev,
      skills: value,
    }));
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const markAsChanged = () => {
    if (currentDraftId) setHasUnsavedChanges(true);
  };

  const createDraft = () => {
    const title = draftTitle.trim() || `Draft ${drafts.length + 1}`;
    const now = Date.now();
    const newDraft: Draft = {
      id: now.toString(),
      title,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + DRAFT_EXPIRY_MS,
      resumeData,
      strengths,
    };
    setDrafts((prev) => [...prev, newDraft]);
    setCurrentDraftId(newDraft.id);
    setDraftTitle('');
    setShowDraftList(false);
  };

  const updateDraft = (draftId: string) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.id === draftId
          ? { ...draft, updatedAt: Date.now(), expiresAt: Date.now() + DRAFT_EXPIRY_MS, resumeData, strengths }
          : draft
      )
    );
  };

  const handleSaveDraft = () => {
    if (!currentDraftId) return;
    
    const draft = drafts.find(d => d.id === currentDraftId);
    const title = draft?.title || currentEditingTitle || `Draft ${drafts.length + 1}`;
    
    if (saveToastTimeout) {
      clearTimeout(saveToastTimeout);
    }
    
    updateDraft(currentDraftId);
    setHasUnsavedChanges(false);
    setToastDraftTitle(title);
    setShowSaveToast(true);
    
    const timeout = setTimeout(() => {
      setShowSaveToast(false);
    }, 3000);
    setSaveToastTimeout(timeout);
  };

  const deleteDraft = (draftId: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
    }
  };

  const loadDraft = (draft: Draft) => {
    setResumeData(draft.resumeData);
    setStrengths(draft.strengths);
    setCurrentDraftId(draft.id);
    setCurrentEditingTitle(draft.title);
    setHasUnsavedChanges(false);
    setShowDraftList(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: 'Be Vietnam Pro',
    },
    header: {
      marginBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: '#1e293b',
      paddingBottom: 15,
    },
    name: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#0f172a',
      textAlign: 'center',
      marginBottom: 5,
    },
    title: {
      fontSize: 16,
      color: '#2563eb',
      textAlign: 'center',
      marginBottom: 10,
      wordBreak: 'break-word',
    },
    contactInfo: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 15,
    },
    contactItem: {
      fontSize: 9,
      color: '#475569',
      wordBreak: 'break-word',
    },
    contactLabel: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#2563eb',
      wordBreak: 'break-word',
    },
    columns: {
      flexDirection: 'row',
      gap: 20,
    },
    leftColumn: {
      flex: 2,
    },
    rightColumn: {
      flex: 1,
    },
    section: {
      marginBottom: 15,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#1e293b',
      marginBottom: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: '#94a3b8',
      paddingBottom: 3,
    },
    bodyText: {
      fontSize: 10,
      color: '#334155',
      lineHeight: 1.5,
      wordBreak: 'break-word',
    },
    entry: {
      marginBottom: 10,
    },
    entryTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#0f172a',
      marginBottom: 2,
      wordBreak: 'break-word',
    },
    entrySubtitle: {
      fontSize: 10,
      color: '#2563eb',
      marginBottom: 2,
      wordBreak: 'break-word',
    },
    entryDate: {
      fontSize: 9,
      color: '#64748b',
      marginBottom: 2,
      wordBreak: 'break-word',
    },
    entryLink: {
      fontSize: 9,
      color: '#2563eb',
      marginBottom: 2,
      wordBreak: 'break-word',
    },
    entryDescription: {
      fontSize: 9,
      color: '#334155',
      lineHeight: 1.4,
      marginTop: 3,
      wordBreak: 'break-word',
    },
    entrySmall: {
      fontSize: 8,
      color: '#475569',
      marginBottom: 2,
      wordBreak: 'break-word',
    },
    skillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    skill: {
      fontSize: 9,
      color: '#ffffff',
      backgroundColor: '#00bfff',
      padding: '3 6',
      borderRadius: 3,
      wordBreak: 'break-word',
    },
    languageItem: {
      fontSize: 9,
      color: '#334155',
      marginBottom: 3,
      wordBreak: 'break-word',
    },
    languageLevel: {
      fontSize: 8,
      color: '#2563eb',
      backgroundColor: '#dbeafe',
      padding: '1 4',
      borderRadius: 2,
      wordBreak: 'break-word',
    },
    strength: {
      fontSize: 9,
      color: '#334155',
      marginBottom: 8,
      lineHeight: 1.4,
      wordBreak: 'break-word',
    },
  });

  const handleDownload = async () => {
    const ResumeDocument = (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.name}>{resumeData.profile.name || t('yourName')}</Text>
            <Text style={styles.title}>{resumeData.profile.title || t('jobTitleFallback')}</Text>
            <View style={styles.contactInfo}>
              {resumeData.profile.email && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('emailLabel')}</Text> {resumeData.profile.email}</Text>}
              {resumeData.profile.phone && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('phoneLabel')}</Text> {resumeData.profile.phone}</Text>}
              {resumeData.profile.location && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('locationLabel')}</Text> {resumeData.profile.location}</Text>}
              {resumeData.profile.website && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('websiteLabel')}</Text> {resumeData.profile.website}</Text>}
              {resumeData.profile.linkedin && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('linkedinLabel')}</Text> {resumeData.profile.linkedin}</Text>}
              {resumeData.profile.facebook && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('facebookLabel')}</Text> {resumeData.profile.facebook}</Text>}
            </View>
          </View>

          {/* Two Column Layout */}
          <View style={styles.columns}>
            {/* Left Column */}
            <View style={styles.leftColumn}>
              {/* Summary */}
              {resumeData.profile.summary && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('selfSummary').toUpperCase()}</Text>
                  <Text style={styles.bodyText}>{resumeData.profile.summary}</Text>
                </View>
              )}

              {/* Work Experience */}
              {resumeData.work.length > 0 && resumeData.work.some(w => w.company || w.position) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('workExperience').toUpperCase()}</Text>
                  {resumeData.work.filter(w => w.company || w.position).map((work) => (
                    <View key={work.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{work.position || t('positionFallback')}</Text>
                      <Text style={styles.entrySubtitle}>{work.company || t('companyFallback')}</Text>
                      {work.startDate && work.endDate && (
                        <Text style={styles.entryDate}>{work.startDate} - {work.endDate}</Text>
                      )}
                      {work.description && <Text style={styles.entryDescription}>{work.description}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Projects */}
              {resumeData.projects.length > 0 && resumeData.projects.some(p => p.name) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('projects').toUpperCase()}</Text>
                  {resumeData.projects.filter(p => p.name).map((project) => (
                    <View key={project.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{project.name}</Text>
                      {project.date && <Text style={styles.entryDate}>{project.date}</Text>}
                      {project.link && <Text style={styles.entryLink}>{project.link}</Text>}
                      {project.description && <Text style={styles.entryDescription}>{project.description}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Right Column */}
            <View style={styles.rightColumn}>
              {/* Skills */}
              {skillsArray.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('skills').toUpperCase()}</Text>
                  <View style={styles.skillsContainer}>
                    {skillsArray.map((skill, index) => (
                      <Text key={index} style={styles.skill}>{skill}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Education */}
              {resumeData.education.length > 0 && resumeData.education.some(e => e.school || e.degree) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('education').toUpperCase()}</Text>
                  {resumeData.education.filter(e => e.school || e.degree).map((edu) => (
                    <View key={edu.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{edu.degree || t('degreeFallback')}</Text>
                      <Text style={styles.entrySubtitle}>{edu.school || t('schoolFallback')}</Text>
                      {(edu.startDate || edu.endDate) && (
                        <Text style={styles.entryDate}>{edu.startDate && edu.endDate ? `${edu.startDate} - ${edu.endDate}` : edu.startDate || edu.endDate}</Text>
                      )}
                      {edu.gpa && <Text style={styles.entrySmall}>GPA: {edu.gpa}</Text>}
                      {edu.academicRank && <Text style={styles.entrySmall}>{t('academicRank')}: {edu.academicRank}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Certifications */}
              {resumeData.certifications.length > 0 && resumeData.certifications.some(c => c.name || c.issuer) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('certifications').toUpperCase()}</Text>
                  {resumeData.certifications.filter(c => c.name || c.issuer).map((cert) => (
                    <View key={cert.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{cert.name || t('certificationFallback')}</Text>
                      <Text style={styles.entrySubtitle}>{cert.issuer || t('issuerFallback')}</Text>
                      {cert.issueDate && (
                        <Text style={styles.entryDate}>
                          {cert.issueDate}{cert.expirationDate ? ` - ${cert.expirationDate}` : ''}
                        </Text>
                      )}
                      {cert.credentialId && <Text style={styles.entrySmall}>ID: {cert.credentialId}</Text>}
                      {cert.credentialUrl && <Text style={styles.entryLink}>{cert.credentialUrl}</Text>}
                      {cert.description && <Text style={styles.entryDescription}>{cert.description}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Strengths */}
              {strengthsArray.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('strengths').toUpperCase()}</Text>
                  {strengthsArray.map((strength, index) => (
                    <Text key={index} style={styles.strength}>• {strength}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Page>
      </Document>
    );

    const blob = await pdf(ResumeDocument).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resume.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    const ResumeDocument = (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.name}>{resumeData.profile.name || t('yourName')}</Text>
            <Text style={styles.title}>{resumeData.profile.title || t('jobTitleFallback')}</Text>
            <View style={styles.contactInfo}>
              {resumeData.profile.email && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('emailLabel')}</Text> {resumeData.profile.email}</Text>}
              {resumeData.profile.phone && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('phoneLabel')}</Text> {resumeData.profile.phone}</Text>}
              {resumeData.profile.location && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('locationLabel')}</Text> {resumeData.profile.location}</Text>}
              {resumeData.profile.website && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('websiteLabel')}</Text> {resumeData.profile.website}</Text>}
              {resumeData.profile.linkedin && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('linkedinLabel')}</Text> {resumeData.profile.linkedin}</Text>}
              {resumeData.profile.facebook && <Text style={styles.contactItem}><Text style={styles.contactLabel}>{t('facebookLabel')}</Text> {resumeData.profile.facebook}</Text>}
            </View>
          </View>

          {/* Two Column Layout */}
          <View style={styles.columns}>
            {/* Left Column */}
            <View style={styles.leftColumn}>
              {/* Summary */}
              {resumeData.profile.summary && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('selfSummary').toUpperCase()}</Text>
                  <Text style={styles.bodyText}>{resumeData.profile.summary}</Text>
                </View>
              )}

              {/* Work Experience */}
              {resumeData.work.length > 0 && resumeData.work.some(w => w.company || w.position) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('workExperience').toUpperCase()}</Text>
                  {resumeData.work.filter(w => w.company || w.position).map((work) => (
                    <View key={work.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{work.position || t('positionFallback')}</Text>
                      <Text style={styles.entrySubtitle}>{work.company || t('companyFallback')}</Text>
                      {work.startDate && work.endDate && (
                        <Text style={styles.entryDate}>{work.startDate} - {work.endDate}</Text>
                      )}
                      {work.description && <Text style={styles.entryDescription}>{work.description}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Projects */}
              {resumeData.projects.length > 0 && resumeData.projects.some(p => p.name) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('projects').toUpperCase()}</Text>
                  {resumeData.projects.filter(p => p.name).map((project) => (
                    <View key={project.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{project.name}</Text>
                      {project.date && <Text style={styles.entryDate}>{project.date}</Text>}
                      {project.link && <Text style={styles.entryLink}>{project.link}</Text>}
                      {project.description && <Text style={styles.entryDescription}>{project.description}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Right Column */}
            <View style={styles.rightColumn}>
              {/* Skills */}
              {skillsArray.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('skills').toUpperCase()}</Text>
                  <View style={styles.skillsContainer}>
                    {skillsArray.map((skill, index) => (
                      <Text key={index} style={styles.skill}>{skill}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Education */}
              {resumeData.education.length > 0 && resumeData.education.some(e => e.school || e.degree) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('education').toUpperCase()}</Text>
                  {resumeData.education.filter(e => e.school || e.degree).map((edu) => (
                    <View key={edu.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{edu.degree || t('degreeFallback')}</Text>
                      <Text style={styles.entrySubtitle}>{edu.school || t('schoolFallback')}</Text>
                      {(edu.startDate || edu.endDate) && (
                        <Text style={styles.entryDate}>{edu.startDate && edu.endDate ? `${edu.startDate} - ${edu.endDate}` : edu.startDate || edu.endDate}</Text>
                      )}
                      {edu.gpa && <Text style={styles.entrySmall}>GPA: {edu.gpa}</Text>}
                      {edu.academicRank && <Text style={styles.entrySmall}>{t('academicRank')}: {edu.academicRank}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Certifications */}
              {resumeData.certifications.length > 0 && resumeData.certifications.some(c => c.name || c.issuer) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('certifications').toUpperCase()}</Text>
                  {resumeData.certifications.filter(c => c.name || c.issuer).map((cert) => (
                    <View key={cert.id} style={styles.entry}>
                      <Text style={styles.entryTitle}>{cert.name || t('certificationFallback')}</Text>
                      <Text style={styles.entrySubtitle}>{cert.issuer || t('issuerFallback')}</Text>
                      {cert.issueDate && (
                        <Text style={styles.entryDate}>
                          {cert.issueDate}{cert.expirationDate ? ` - ${cert.expirationDate}` : ''}
                        </Text>
                      )}
                      {cert.credentialId && <Text style={styles.entrySmall}>ID: {cert.credentialId}</Text>}
                      {cert.credentialUrl && <Text style={styles.entryLink}>{cert.credentialUrl}</Text>}
                      {cert.description && <Text style={styles.entryDescription}>{cert.description}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Languages */}
              {resumeData.languages.length > 0 && resumeData.languages.some(l => l.name) && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('langs').toUpperCase()}</Text>
                  {resumeData.languages.filter(l => l.name).map((lang) => (
                    <View key={lang.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={styles.languageItem}>{lang.name}</Text>
                      <Text style={styles.languageLevel}>{lang.proficiency}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Strengths */}
              {strengthsArray.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{t('strengths').toUpperCase()}</Text>
                  {strengthsArray.map((strength, index) => (
                    <Text key={index} style={styles.strength}>• {strength}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Page>
      </Document>
    );

    const blob = await pdf(ResumeDocument).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const skillsArray = resumeData.skills
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s);

  const strengthsArray = strengths
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s);

  const tabs = [
    { id: 'profile' as TabType, label: t('profile'), icon: User },
    { id: 'work' as TabType, label: t('work'), icon: Briefcase },
    { id: 'projects' as TabType, label: t('projects'), icon: Code },
    { id: 'education' as TabType, label: t('education'), icon: GraduationCap },
    { id: 'certifications' as TabType, label: t('certifications'), icon: Award },
    { id: 'languages' as TabType, label: t('langs'), icon: Globe },
    { id: 'skills' as TabType, label: t('skills'), icon: Sparkles },
    { id: 'strengths' as TabType, label: t('strengths'), icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 print:p-0 print:bg-white">
      {/* Header - Hidden on print */}
<header className="mb-4 flex items-center justify-between print:hidden">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-3xl">📄</span> {t('resumeMe')}
          </h1>
          <div className="flex gap-2">
<button
              onClick={() => setShowDraftList(!showDraftList)}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors font-medium"
            >
              <FolderOpen size={18} />
              {t('drafts')}
              {drafts.length > 0 && (
                <span className="ml-1 bg-amber-800 text-xs px-1.5 py-0.5 rounded-full">
                  {drafts.length}
                </span>
              )}
            </button>
            {currentDraftId && (
              <button
                onClick={handleSaveDraft}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium",
                  hasUnsavedChanges
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-slate-400 text-white cursor-not-allowed"
                )}
                disabled={!hasUnsavedChanges}
              >
                <Save size={18} />
                Save
              </button>
            )}
            <button
            onClick={handlePreview}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            👁️ Preview PDF
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Download size={18} />
            {t('downloadPdf')}
          </button>
        </div>
        <button
          onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
          className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium"
        >
          {language === 'en' ? '🇻🇳 VI' : '🇺🇸 EN'}
        </button>
      </header>

      {/* Draft Title Display - Shown when editing a draft */}
      {currentDraftId && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-700 font-medium">Editing:</span>
            <span className="text-amber-900 font-semibold text-lg">
              {drafts.find(d => d.id === currentDraftId)?.title || currentEditingTitle || `Draft ${drafts.length + 1}`}
            </span>
            {!hasUnsavedChanges && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Saved
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex gap-4 h-[calc(100vh-80px)] print:h-auto print:block">
        {/* Editor Panel - Hidden on print */}
        <div className="w-[40%] bg-white rounded-xl shadow-lg overflow-hidden flex flex-col print:hidden animate-in fade-in slide-in-from-left-4 duration-300">
          {/* Tab Navigation */}
          <nav className="flex border-b border-slate-200 bg-slate-50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 px-2 text-sm font-medium transition-all relative',
                  activeTab === tab.id
                    ? 'text-blue-600 bg-white'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                )}
              >
                <tab.icon size={16} />
                <span className="hidden lg:inline">{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </nav>

          {/* Editor Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <h3 className="text-lg font-semibold text-slate-800">{t('personalInformation')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('fullName')}</label>
                    <input
                      type="text"
                      value={resumeData.profile.name}
                      onChange={(e) => updateProfile('name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('jobTitle')}</label>
                    <input
                      type="text"
                      value={resumeData.profile.title}
                      onChange={(e) => updateProfile('title', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Kỹ sư phần mềm cấp cao"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('email')}</label>
                      <input
                        type="email"
                        value={resumeData.profile.email}
                        onChange={(e) => updateProfile('email', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="nguyenvana@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('phone')}</label>
                      <input
                        type="tel"
                        value={resumeData.profile.phone}
                        onChange={(e) => updateProfile('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="+84 123 456 789"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('location')}</label>
                    <input
                      type="text"
                      value={resumeData.profile.location}
                      onChange={(e) => updateProfile('location', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Hà Nội, Việt Nam"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('website')}</label>
                      <input
                        type="text"
                        value={resumeData.profile.website}
                        onChange={(e) => updateProfile('website', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="https://nguyenvana.dev"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('linkedin')}</label>
                      <input
                        type="text"
                        value={resumeData.profile.linkedin}
                        onChange={(e) => updateProfile('linkedin', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="linkedin.com/in/nguyenvana"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('facebook')}</label>
                    <input
                      type="text"
                      value={resumeData.profile.facebook}
                      onChange={(e) => updateProfile('facebook', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="facebook.com/nguyenvana"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('selfSummary')}</label>
                    <textarea
                      value={resumeData.profile.summary}
                      onChange={(e) => updateProfile('summary', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                      placeholder={t('selfSummaryPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Work Tab */}
            {activeTab === 'work' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">{t('workExperience')}</h3>
                  <button
                    onClick={addWorkExperience}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
                {resumeData.work.map((work, index) => (
                  <div key={work.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">Position {index + 1}</span>
                      <button
                        onClick={() => deleteWorkExperience(work.id)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('company')}</label>
                      <input
                        type="text"
                        value={work.company}
                        onChange={(e) => updateWorkExperience(work.id, 'company', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('company')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('position')}</label>
                      <input
                        type="text"
                        value={work.position}
                        onChange={(e) => updateWorkExperience(work.id, 'position', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('jobTitle')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('startDate')}</label>
                        <input
                          type="text"
                          value={work.startDate}
                          onChange={(e) => updateWorkExperience(work.id, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="2021-03"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('endDate')}</label>
                        <input
                          type="text"
                          value={work.endDate}
                          onChange={(e) => updateWorkExperience(work.id, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder={t('present')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <textarea
                        value={work.description}
                        onChange={(e) => updateWorkExperience(work.id, 'description', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                        placeholder={t('workDescriptionPlaceholder')}
                      />
                    </div>
                  </div>
                ))}
                {resumeData.work.length === 0 && (
                  <p className="text-slate-500 text-center py-4">No work experience added yet. Click &quot;Add&quot; to add one.</p>
                )}
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Projects</h3>
                  <button
                    onClick={addProject}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
                {resumeData.projects.map((project, index) => (
                  <div key={project.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">Project {index + 1}</span>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('projectName')}</label>
                      <input
                        type="text"
                        value={project.name}
                        onChange={(e) => updateProject(project.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('projectName')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('datePeriod')}</label>
                        <input
                          type="text"
                          value={project.date}
                          onChange={(e) => updateProject(project.id, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="2023"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Link</label>
                        <input
                          type="text"
                          value={project.link}
                          onChange={(e) => updateProject(project.id, 'link', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="https://github.com/..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('description')}</label>
                      <textarea
                        value={project.description}
                        onChange={(e) => updateProject(project.id, 'description', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                        placeholder={t('projectDescriptionPlaceholder')}
                      />
                    </div>
                  </div>
                ))}
                {resumeData.projects.length === 0 && (
                  <p className="text-slate-500 text-center py-4">No projects added yet. Click &quot;Add&quot; to add one.</p>
                )}
              </div>
            )}

            {/* Education Tab */}
            {activeTab === 'education' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Education</h3>
                  <button
                    onClick={addEducation}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
                {resumeData.education.map((edu, index) => (
                  <div key={edu.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">Education {index + 1}</span>
                      <button
                        onClick={() => deleteEducation(edu.id)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('schoolUniversity')}</label>
                      <input
                        type="text"
                        value={edu.school}
                        onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('schoolPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('degree')}</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('degreePlaceholder')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('startDate')}</label>
                        <input
                          type="text"
                          value={edu.startDate}
                          onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="2014-09"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('endDate')}</label>
                        <input
                          type="text"
                          value={edu.endDate}
                          onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="2018-05"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('gpa')}</label>
                        <input
                          type="text"
                          value={edu.gpa}
                          onChange={(e) => updateEducation(edu.id, 'gpa', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="3.8/4.0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('academicRank')}</label>
                        <input
                          type="text"
                          value={edu.academicRank}
                          onChange={(e) => updateEducation(edu.id, 'academicRank', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="Excellent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {resumeData.education.length === 0 && (
                  <p className="text-slate-500 text-center py-4">{t('noEducationYet')}</p>
                )}
              </div>
            )}

            {/* Certifications Tab */}
            {activeTab === 'certifications' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">{t('certifications')}</h3>
                  <button
                    onClick={addCertification}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={16} /> {t('add')}
                  </button>
                </div>
                {resumeData.certifications.map((cert, index) => (
                  <div key={cert.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">{t('certificationName')} {index + 1}</span>
                      <button
                        onClick={() => deleteCertification(cert.id)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('certificationName')}</label>
                      <input
                        type="text"
                        value={cert.name}
                        onChange={(e) => updateCertification(cert.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('certificationName')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('issuer')}</label>
                      <input
                        type="text"
                        value={cert.issuer}
                        onChange={(e) => updateCertification(cert.id, 'issuer', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('issuer')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('issueDate')}</label>
                        <input
                          type="text"
                          value={cert.issueDate}
                          onChange={(e) => updateCertification(cert.id, 'issueDate', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="2023-03"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('expirationDate')}</label>
                        <input
                          type="text"
                          value={cert.expirationDate}
                          onChange={(e) => updateCertification(cert.id, 'expirationDate', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="2025-03"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('credentialId')}</label>
                        <input
                          type="text"
                          value={cert.credentialId}
                          onChange={(e) => updateCertification(cert.id, 'credentialId', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder={t('credentialId')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('credentialUrl')}</label>
                        <input
                          type="text"
                          value={cert.credentialUrl}
                          onChange={(e) => updateCertification(cert.id, 'credentialUrl', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('certificationDescription')}</label>
                      <textarea
                        value={cert.description}
                        onChange={(e) => updateCertification(cert.id, 'description', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                        placeholder={t('certificationDescription')}
                      />
                    </div>
                  </div>
                ))}
                {resumeData.certifications.length === 0 && (
                  <p className="text-slate-500 text-center py-4">{t('noCertificationsYet')}</p>
                )}
              </div>
            )}

            {/* Languages Tab */}
            {activeTab === 'languages' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">{t('langs')}</h3>
                  <button
                    onClick={addLanguage}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={16} /> {t('add')}
                  </button>
                </div>
                {resumeData.languages.map((lang, index) => (
                  <div key={lang.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">{t('langs')} {index + 1}</span>
                      <button
                        onClick={() => deleteLanguage(lang.id)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('languageName')}</label>
                      <input
                        type="text"
                        value={lang.name}
                        onChange={(e) => updateLanguage(lang.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="English, Japanese, Korean..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('proficiencyLevel')}</label>
                      <select
                        value={lang.proficiency}
                        onChange={(e) => updateLanguage(lang.id, 'proficiency', e.target.value as ProficiencyLevel)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="Beginner">{t('beginner')}</option>
                        <option value="Elementary">{t('elementary')}</option>
                        <option value="Intermediate">{t('intermediate')}</option>
                        <option value="Upper Intermediate">{t('upperIntermediate')}</option>
                        <option value="Advanced">{t('advanced')}</option>
                        <option value="Fluent">{t('fluent')}</option>
                      </select>
                    </div>
                  </div>
                ))}
                {resumeData.languages.length === 0 && (
                  <p className="text-slate-500 text-center py-4">{t('noLanguagesYet')}</p>
                )}
              </div>
            )}

            {/* Skills Tab */}
            {activeTab === 'skills' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <h3 className="text-lg font-semibold text-slate-800">Skills</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Enter skills separated by commas
                  </label>
                  <textarea
                    value={resumeData.skills}
                    onChange={(e) => handleSkillsChange(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="JavaScript, TypeScript, React, Node.js, Python, AWS..."
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Example: JavaScript, TypeScript, React, Node.js, Python, AWS, Docker
                  </p>
                </div>
                {skillsArray.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Preview:</h4>
                    <div className="flex flex-wrap gap-2">
                      {skillsArray.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-[#00bfff] text-white text-sm rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Strengths Tab */}
            {activeTab === 'strengths' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <h3 className="text-lg font-semibold text-slate-800">Strengths</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Enter strengths separated by commas
                  </label>
                  <textarea
                    value={strengths}
                    onChange={(e) => handleStrengthsChange(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="Strong problem-solving abilities, Excellent communication skills..."
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Example: Strong problem-solving abilities, Excellent communication skills, Team player
                  </p>
                </div>
                {strengthsArray.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Preview:</h4>
                    <ul className="space-y-2">
                      {strengthsArray.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-blue-600 mt-0.5">•</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="w-[60%] print:w-full overflow-auto flex justify-center bg-slate-200 p-4 print:p-0 print:bg-white print:overflow-visible">
          <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl print:shadow-none print:w-full print:min-h-0 print:m-0 animate-in fade-in zoom-in-95 duration-300">
            {/* Resume Preview - Modern Executive Style */}
            <div className="p-8 print:p-0">
              {/* Header */}
              <header className="mb-6 border-b-2 border-slate-800 pb-4">
                {/* Name and Title - Centered */}
                <div className="text-center mb-4">
                  <h1 className="text-4xl font-bold text-slate-900 mb-1">
                    {resumeData.profile.name || t('yourName')}
                  </h1>
                  <p className="text-xl text-blue-600 font-medium">
                    {resumeData.profile.title || t('jobTitleFallback')}
                  </p>
                </div>
                {/* Contact Info - Horizontal row with dividers */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
                  {resumeData.profile.email && (
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600 font-medium">{t('emailLabel')}</span>
                      {resumeData.profile.email}
                    </span>
                  )}
                  {resumeData.profile.phone && (
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600 font-medium">{t('phoneLabel')}</span>
                      {resumeData.profile.phone}
                    </span>
                  )}
                  {resumeData.profile.location && (
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600 font-medium">{t('locationLabel')}</span>
                      {resumeData.profile.location}
                    </span>
                  )}
                  {resumeData.profile.website && (
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600 font-medium">{t('websiteLabel')}</span>
                      {resumeData.profile.website}
                    </span>
                  )}
                  {resumeData.profile.linkedin && (
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600 font-medium">{t('linkedinLabel')}</span>
                      {resumeData.profile.linkedin}
                    </span>
                  )}
                  {resumeData.profile.facebook && (
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600 font-medium">{t('facebookLabel')}</span>
                      {resumeData.profile.facebook}
                    </span>
                  )}
                </div>
              </header>

              {/* Two Column Layout */}
              <div className="grid grid-cols-12 gap-6">
                {/* Left Column - 8/12 */}
                <div className="col-span-8 space-y-6">
                  {/* Summary */}
                  {resumeData.profile.summary && (
                    <section>
                      <h2 className="text-lg font-bold text-slate-800 mb-2 uppercase tracking-wide border-b border-slate-300 pb-1">
                        {t('selfSummary')}
                      </h2>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {resumeData.profile.summary}
                      </p>
                    </section>
                  )}

                  {/* Work Experience */}
                  {resumeData.work.length > 0 && resumeData.work.some(w => w.company || w.position) && (
                    <section>
                      <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">
                        {t('workExperience')}
                      </h2>
                      <div className="space-y-4">
                        {resumeData.work.filter(w => w.company || w.position).map((work) => (
                          <div key={work.id}>
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <h3 className="font-semibold text-slate-900">{work.position || t('positionFallback')}</h3>
                                <p className="text-blue-600 text-sm">{work.company || t('companyFallback')}</p>
                              </div>
                              <span className="text-sm text-slate-500">
                                {work.startDate && work.endDate ? `${work.startDate} - ${work.endDate}` : ''}
                              </span>
                            </div>
                            {work.description && (
                              <p className="text-sm text-slate-600 leading-relaxed mt-1">
                                {work.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Projects */}
                  {resumeData.projects.length > 0 && resumeData.projects.some(p => p.name) && (
                    <section>
                      <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">
                        {t('projects')}
                      </h2>
                      <div className="space-y-4">
                        {resumeData.projects.filter(p => p.name).map((project) => (
                          <div key={project.id} className="mb-3">
                            <div className="flex justify-between items-start">
                              <h3 className="font-semibold text-slate-900">{project.name}</h3>
                              {project.date && (
                                <span className="text-sm text-slate-500">{project.date}</span>
                              )}
                            </div>
                            {project.link && (
                              <a
                                href={project.link.startsWith('http') ? project.link : `https://${project.link}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 text-xs hover:underline"
                              >
                                {project.link}
                              </a>
                            )}
                            {project.description && (
                              <p className="text-sm text-slate-600 leading-relaxed mt-1">
                                {project.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Right Column - 4/12 */}
                <div className="col-span-4 space-y-6">
                  {/* Skills */}
                  {skillsArray.length > 0 && (
                    <section>
                      <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">
                        {t('skills')}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {skillsArray.map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-sky-400 text-white text-xs rounded-md"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Education */}
                  {resumeData.education.length > 0 && resumeData.education.some(e => e.school || e.degree) && (
                    <section>
                      <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">
                        {t('education')}
                      </h2>
                      <div className="space-y-3">
                        {resumeData.education.filter(e => e.school || e.degree).map((edu) => (
                          <div key={edu.id}>
                            <h3 className="font-semibold text-slate-900 text-sm">{edu.degree || t('degreeFallback')}</h3>
                            <p className="text-blue-600 text-sm">{edu.school || t('schoolFallback')}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {(edu.startDate || edu.endDate) ? (edu.startDate && edu.endDate ? `${edu.startDate} - ${edu.endDate}` : edu.startDate || edu.endDate) : ''}
                            </p>
                            {edu.gpa && <p className="text-xs text-slate-600 mt-1">GPA: {edu.gpa}</p>}
                            {edu.academicRank && <p className="text-xs text-slate-600">{t('academicRank')}: {edu.academicRank}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Certifications */}
                  {resumeData.certifications.length > 0 && resumeData.certifications.some(c => c.name || c.issuer) && (
                    <section>
                      <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">
                        {t('certifications')}
                      </h2>
                      <div className="space-y-3">
                        {resumeData.certifications.filter(c => c.name || c.issuer).map((cert) => (
                          <div key={cert.id}>
                            <h3 className="font-semibold text-slate-900 text-sm">{cert.name || t('certificationFallback')}</h3>
                            <p className="text-blue-600 text-sm">{cert.issuer || t('issuerFallback')}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {cert.issueDate && `${cert.issueDate}${cert.expirationDate ? ' - ' + cert.expirationDate : ''}`}
                            </p>
                            {cert.credentialId && (
                              <p className="text-xs text-slate-600 mt-1">
                                ID: {cert.credentialId}
                              </p>
                            )}
                            {cert.credentialUrl && (
                              <a
                                href={cert.credentialUrl.startsWith('http') ? cert.credentialUrl : `https://${cert.credentialUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 text-xs hover:underline"
                              >
                                {t('credentialUrl')}
                              </a>
                            )}
                            {cert.description && (
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {cert.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Languages */}
                  {resumeData.languages.length > 0 && resumeData.languages.some(l => l.name) && (
                    <section>
                      <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">
                        {t('langs')}
                      </h2>
                      <div className="space-y-2">
                        {resumeData.languages.filter(l => l.name).map((lang) => (
                          <div key={lang.id} className="flex justify-between items-center">
                            <span className="text-sm text-slate-700">{lang.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              {lang.proficiency === 'Beginner' ? t('beginner') :
                               lang.proficiency === 'Elementary' ? t('elementary') :
                               lang.proficiency === 'Intermediate' ? t('intermediate') :
                               lang.proficiency === 'Upper Intermediate' ? t('upperIntermediate') :
                               lang.proficiency === 'Advanced' ? t('advanced') :
                               t('fluent')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Strengths */}
                  <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">
                      {t('strengths')}
                    </h2>
                    {strengthsArray.length > 0 ? (
                      <ul className="space-y-2 text-sm text-slate-700">
                        {strengthsArray.map((strength, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span className="leading-relaxed">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">Add your strengths in the editor</p>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Draft List Panel */}
      {showDraftList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-amber-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FolderOpen size={20} className="text-amber-600" />
                {t('drafts')}
              </h2>
              <button
                onClick={() => setShowDraftList(false)}
                className="text-slate-500 hover:text-slate-700 p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                  placeholder={t('draftTitle')}
                  onKeyDown={(e) => e.key === 'Enter' && createDraft()}
                />
                <button
                  onClick={createDraft}
                  className="flex items-center gap-1 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors font-medium"
                >
                  <Plus size={18} />
                  {t('addDraft')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {drafts.length === 0 ? (
                <div className="text-center py-8">
                  <File size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">{t('noDrafts')}</p>
                  <p className="text-slate-400 text-sm">{t('noDraftsDesc')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      onClick={() => loadDraft(draft)}
                      className={`border rounded-lg p-3 transition-all cursor-pointer ${
                        currentDraftId === draft.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-800 flex items-center gap-2">
                            {currentDraftId === draft.id && (
                              <span className="w-2 h-2 bg-amber-500 rounded-full" />
                            )}
                            {draft.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {t('createdAt')}: {formatDate(draft.createdAt)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t('lastModified')}: {formatDate(draft.updatedAt)}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                            <Clock size={12} />
                            {t('expiresIn')}: {countdown[draft.id] || 'Calculating...'}
                          </div>
                        </div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => loadDraft(draft)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title={t('editDraft')}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => deleteDraft(draft.id)}
                            className="text-red-500 hover:text-red-600 p-1"
                            title={t('deleteDraft')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
          <Save size={20} />
          <span>Changes saved - "{toastDraftTitle}"</span>
        </div>
      )}
    </div>
  );
}