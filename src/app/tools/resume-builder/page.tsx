'use client';

import { useState } from 'react';
import {
  User,
  Briefcase,
  Code,
  GraduationCap,
  Sparkles,
  Plus,
  Trash2,
  Download,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Facebook,
  Trophy,
  Award,
} from 'lucide-react';
import { ResumeData, WorkExperience, Project, Education, Certification, initialResumeData } from '@/lib/resume-types';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/language-context';

type TabType = 'profile' | 'work' | 'projects' | 'education' | 'certifications' | 'skills' | 'strengths';

export default function ResumeBuilder() {
  const { t, language, setLanguage } = useLanguage();
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [strengths, setStrengths] = useState<string>(
    'Type your strength 1, Type your strength 2, Type your strength 3, Type your strength 4'
  );

  const updateProfile = (field: keyof ResumeData['profile'], value: string) => {
    setResumeData((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value },
    }));
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
  };

  const updateWorkExperience = (id: string, field: keyof WorkExperience, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      work: prev.work.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const deleteWorkExperience = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      work: prev.work.filter((item) => item.id !== id),
    }));
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
  };

  const updateProject = (id: string, field: keyof Project, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      projects: prev.projects.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const deleteProject = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      projects: prev.projects.filter((item) => item.id !== id),
    }));
  };

  const addEducation = () => {
    const newEducation: Education = {
      id: Date.now().toString(),
      school: '',
      degree: '',
      startDate: '',
      endDate: '',
    };
    setResumeData((prev) => ({
      ...prev,
      education: [...prev.education, newEducation],
    }));
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      education: prev.education.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const deleteEducation = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      education: prev.education.filter((item) => item.id !== id),
    }));
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
  };

  const updateCertification = (id: string, field: keyof Certification, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      certifications: prev.certifications.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const deleteCertification = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((item) => item.id !== id),
    }));
  };

  const handleSkillsChange = (value: string) => {
    setResumeData((prev) => ({
      ...prev,
      skills: value,
    }));
  };

  const handleDownload = () => {
    window.print();
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
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Download size={18} />
          {t('downloadPdf')}
        </button>
        <button
          onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
          className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium"
        >
          {language === 'en' ? '🇻🇳 VI' : '🇺🇸 EN'}
        </button>
      </header>

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
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('jobTitle')}</label>
                    <input
                      type="text"
                      value={resumeData.profile.title}
                      onChange={(e) => updateProfile('title', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Senior Software Engineer"
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
                        placeholder="john@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('phone')}</label>
                      <input
                        type="tel"
                        value={resumeData.profile.phone}
                        onChange={(e) => updateProfile('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="+1 (555) 123-4567"
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
                      placeholder="San Francisco, CA"
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
                        placeholder="https://johndoe.dev"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('linkedin')}</label>
                      <input
                        type="text"
                        value={resumeData.profile.linkedin}
                        onChange={(e) => updateProfile('linkedin', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="linkedin.com/in/johndoe"
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
                      placeholder="facebook.com/johndoe"
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
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
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
                    onChange={(e) => setStrengths(e.target.value)}
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
                    {resumeData.profile.name || 'Your Name'}
                  </h1>
                  <p className="text-xl text-blue-600 font-medium">
                    {resumeData.profile.title || t('jobTitle')}
                  </p>
                </div>
                {/* Contact Info - Horizontal row with dividers */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
                  {resumeData.profile.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={14} className="text-blue-600" />
                      {resumeData.profile.email}
                    </span>
                  )}
                  {resumeData.profile.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={14} className="text-blue-600" />
                      {resumeData.profile.phone}
                    </span>
                  )}
                  {resumeData.profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} className="text-blue-600" />
                      {resumeData.profile.location}
                    </span>
                  )}
                  {resumeData.profile.website && (
                    <span className="flex items-center gap-1">
                      <Globe size={14} className="text-blue-600" />
                      {resumeData.profile.website}
                    </span>
                  )}
                  {resumeData.profile.linkedin && (
                    <span className="flex items-center gap-1">
                      <Linkedin size={14} className="text-blue-600" />
                      {resumeData.profile.linkedin}
                    </span>
                  )}
                  {resumeData.profile.facebook && (
                    <span className="flex items-center gap-1">
                      <Facebook size={14} className="text-blue-600" />
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
                                <h3 className="font-semibold text-slate-900">{work.position || 'Position'}</h3>
                                <p className="text-blue-600 text-sm">{work.company || 'Company'}</p>
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
                            className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md"
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
                            <h3 className="font-semibold text-slate-900 text-sm">{edu.degree || t('degree')}</h3>
                            <p className="text-blue-600 text-sm">{edu.school || t('school')}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {edu.startDate && edu.endDate ? `${edu.startDate} - ${edu.endDate}` : ''}
                            </p>
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
                            <h3 className="font-semibold text-slate-900 text-sm">{cert.name || 'Certification'}</h3>
                            <p className="text-blue-600 text-sm">{cert.issuer || 'Issuer'}</p>
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
    </div>
  );
}