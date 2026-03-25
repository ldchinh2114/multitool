'use client';

import { createContext, useContext, useState, useLayoutEffect, ReactNode } from 'react';

export type Language = 'en' | 'vi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationsKey) => string;
}

type TranslationsKey = keyof typeof translations.en;

const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    currency: 'Currency Converter',
    dictionary: 'Dictionary',
    unit: 'Unit Converter',
    // Dashboard
    multiToolHub: 'Multi-Tool Hub',
    welcomeMessage: 'All-in-One Online Tools',
    searchTools: 'Search tools...',
    heroTitlePart1: 'Everything you need, ',
    heroTitlePart2: 'right here',
    heroSubtitle: 'A collection of powerful tools built to make your daily tasks easier. Fast, free, and always available.',
    openTool: 'Open Tool',
    lightningFast: 'Lightning Fast',
    lightningFastDesc: 'Instant results with no delays. Built for speed and efficiency.',
    privacyFirst: 'Privacy First',
    privacyFirstDesc: 'No data collection. Your searches stay private.',
    mobileFriendly: 'Mobile Friendly',
    mobileFriendlyDesc: 'Works perfectly on all devices and screen sizes.',
    currencyDesc: 'Convert between major currencies with real-time exchange rates. Support for USD, VND, EUR, JPY, and GBP.',
    dictionaryDesc: 'Look up word definitions, pronunciations, and translate between English and Vietnamese. Perfect for learners.',
    unitDesc: 'Convert between different units of length and weight. Quick and accurate conversions.',
    resumeBuilder: 'Resume Builder',
    resumeBuilderDesc: 'Create professional resumes with live preview and PDF export. Modern templates and easy customization.',
    // Currency
    fromCurrency: 'From',
    toCurrency: 'To',
    amount: 'Amount',
    convert: 'Convert',
    result: 'Result',
    exchangeRate: 'Exchange Rate',
    lastUpdated: 'Last Updated',
    currencyTitle: 'Currency Converter',
    currencySubtitle: 'Real-time exchange rates for major currencies',
    enterAmount: 'Enter amount',
    quickReference: 'Quick Reference (1 USD)',
    loadingRates: 'Loading exchange rates...',
    errorLoadingRates: 'Error Loading Rates',
    // Dictionary
    searchWord: 'Search word...',
    search: 'Search',
    definitions: 'Definitions',
    examples: 'Examples',
    phonetics: 'Phonetics',
    noDefinition: 'No definition found',
    enterWord: 'Enter a word to search',
    dictionaryTitle: 'English Dictionary',
    dictionarySubtitle: 'Look up word definitions, pronunciations, and more',
    mainMeaning: 'Vietnamese Meaning',
    translateToVi: 'Translate to Vietnamese',
    translateToEn: 'Translate to English',
    originalEnglish: 'Show Original English',
    translationError: 'Could not translate at this time',
    translating: 'Translating...',
    translatorMode: 'Translator',
    dictionaryMode: 'Dictionary',
    enterTextToTranslate: 'Enter text to translate...',
    swapLanguages: 'Swap languages',
    clearText: 'Clear text',
    copyTranslation: 'Copy translation',
    copied: 'Copied!',
    sourceLanguage: 'Source Language',
    targetLanguage: 'Target Language',
    english: 'English',
    vietnamese: 'Vietnamese',
    // Unit Converter
    category: 'Category',
    length: 'Length',
    weight: 'Weight',
    fromUnit: 'From Unit',
    toUnit: 'To Unit',
    value: 'Value',
    unitTitle: 'Unit Converter',
    unitSubtitle: 'Convert between different units of length and weight',
    enterValue: 'Enter value',
    // Resume Builder
    resumeMe: 'ResumeMe',
    downloadPdf: 'Download PDF',
    profile: 'Profile',
    work: 'Work',
    projects: 'Projects',
    education: 'Education',
    skills: 'Skills',
    strengths: 'Strengths',
    personalInformation: 'Personal Information',
    fullName: 'Full Name',
    jobTitle: 'Job Title',
    email: 'Email',
    phone: 'Phone',
    location: 'Location',
    website: 'Website',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    selfSummary: 'Self Summary',
    workExperience: 'Work Experience',
    company: 'Company',
    position: 'Position',
    startDate: 'Start Date',
    endDate: 'End Date',
    description: 'Description',
    add: 'Add',
    projectName: 'Project Name',
    date: 'Date',
    link: 'Link',
    school: 'School',
    schoolUniversity: 'School/University',
    degree: 'Degree',
    datePeriod: 'Date/Period',
    present: 'Present',
    selfSummaryPlaceholder: 'Write a brief summary of your professional background...',
    workDescriptionPlaceholder: 'Describe your responsibilities and achievements...',
    projectDescriptionPlaceholder: 'Describe the project and your contributions...',
    schoolPlaceholder: 'University Name',
    degreePlaceholder: 'Bachelor of Science in...',
    enterSkills: 'Enter skills separated by commas',
    skillsExample: 'Example: JavaScript, TypeScript, React, Node.js, Python, AWS, Docker',
    skillsPreview: 'Preview:',
    enterStrengths: 'Enter strengths separated by commas',
    strengthsExample: 'Example: Strong problem-solving abilities, Excellent communication skills, Team player',
    strengthsPreview: 'Preview:',
    noEducationYet: 'No education added yet. Click "Add" to add one.',
    // Certifications
    certifications: 'Certifications',
    certificationName: 'Certification Name',
    issuer: 'Issuer',
    issueDate: 'Issue Date',
    expirationDate: 'Expiration Date',
    credentialId: 'Credential ID',
    credentialUrl: 'Credential URL',
    certificationDescription: 'Description',
    noCertificationsYet: 'No certifications added yet. Click "Add" to add one.',
    // Common
    loading: 'Loading...',
    error: 'Error',
    tryAgain: 'Try Again',
    noResults: 'No results found',
    selectCategory: 'Select category',
  },
  vi: {
    // Navigation
    dashboard: 'Trang chủ',
    currency: 'Chuyển đổi tiền tệ',
    dictionary: 'Từ điển',
    unit: 'Chuyển đổi đơn vị',
    // Dashboard
    multiToolHub: 'Trung tâm công cụ',
    welcomeMessage: 'Tất cả trong một công cụ trực tuyến',
    searchTools: 'Tìm kiếm công cụ...',
    heroTitlePart1: 'Mọi thứ bạn cần, ',
    heroTitlePart2: 'ngay tại đây',
    heroSubtitle: 'Bộ sưu tập các công cụ mạnh mẽ được xây dựng để giúp các tác vụ hàng ngày của bạn dễ dàng hơn. Nhanh chóng, miễn phí và luôn sẵn sàng.',
    openTool: 'Mở công cụ',
    lightningFast: 'Tốc độ cực nhanh',
    lightningFastDesc: 'Kết quả tức thì không chậm trễ. Được xây dựng để tối ưu tốc độ và hiệu quả.',
    privacyFirst: 'Quyền riêng tư là trên hết',
    privacyFirstDesc: 'Không thu thập dữ liệu. Tìm kiếm của bạn luôn được bảo mật.',
    mobileFriendly: 'Thân thiện với di động',
    mobileFriendlyDesc: 'Hoạt động hoàn hảo trên mọi thiết bị và kích thước màn hình.',
    currencyDesc: 'Chuyển đổi giữa các loại tiền tệ chính với tỷ giá hối đoái thời gian thực. Hỗ trợ USD, VND, EUR, JPY và GBP.',
    dictionaryDesc: 'Tra cứu định nghĩa từ, cách phát âm và dịch giữa tiếng Anh và tiếng Việt. Hoàn hảo cho người học.',
    unitDesc: 'Chuyển đổi giữa các đơn vị chiều dài và trọng lượng khác nhau. Chuyển đổi nhanh chóng và chính xác.',
    resumeBuilder: 'Tạo CV',
    resumeBuilderDesc: 'Tạo CV chuyên nghiệp với xem trước trực tiếp và xuất PDF. Mẫu hiện đại và dễ tùy chỉnh.',
    // Currency
    fromCurrency: 'Từ',
    toCurrency: 'Đến',
    amount: 'Số tiền',
    convert: 'Chuyển đổi',
    result: 'Kết quả',
    exchangeRate: 'Tỷ giá',
    lastUpdated: 'Cập nhật lần cuối',
    currencyTitle: 'Chuyển đổi tiền tệ',
    currencySubtitle: 'Tỷ giá hối đoái thời gian thực cho các loại tiền tệ chính',
    enterAmount: 'Nhập số tiền',
    quickReference: 'Tham khảo nhanh (1 USD)',
    loadingRates: 'Đang tải tỷ giá...',
    errorLoadingRates: 'Lỗi khi tải tỷ giá',
    // Dictionary
    searchWord: 'Tìm từ...',
    search: 'Tìm kiếm',
    definitions: 'Định nghĩa',
    examples: 'Ví dụ',
    phonetics: 'Phiên âm',
    noDefinition: 'Không tìm thấy định nghĩa',
    enterWord: 'Nhập từ để tìm kiếm',
    dictionaryTitle: 'Từ điển Anh-Anh',
    dictionarySubtitle: 'Tra cứu định nghĩa từ, cách phát âm và nhiều hơn nữa',
    mainMeaning: 'Nghĩa tiếng Việt',
    translateToVi: 'Dịch sang tiếng Việt',
    translateToEn: 'Dịch sang tiếng Anh',
    originalEnglish: 'Xem tiếng Anh gốc',
    translationError: 'Không thể dịch vào lúc này',
    translating: 'Đang dịch...',
    translatorMode: 'Trình dịch',
    dictionaryMode: 'Từ điển',
    enterTextToTranslate: 'Nhập nội dung cần dịch...',
    swapLanguages: 'Đổi ngôn ngữ',
    clearText: 'Xóa văn bản',
    copyTranslation: 'Sao chép bản dịch',
    copied: 'Đã sao chép!',
    sourceLanguage: 'Ngôn ngữ nguồn',
    targetLanguage: 'Ngôn ngữ đích',
    english: 'Tiếng Anh',
    vietnamese: 'Tiếng Việt',
    // Unit Converter
    category: 'Danh mục',
    length: 'Chiều dài',
    weight: 'Cân nặng',
    fromUnit: 'Từ đơn vị',
    toUnit: 'Đến đơn vị',
    value: 'Giá trị',
    unitTitle: 'Chuyển đổi đơn vị',
    unitSubtitle: 'Chuyển đổi giữa các đơn vị chiều dài và trọng lượng khác nhau',
    enterValue: 'Nhập giá trị',
    // Common
    loading: 'Đang tải...',
    error: 'Lỗi',
    tryAgain: 'Thử lại',
    noResults: 'Không tìm thấy kết quả',
    selectCategory: 'Chọn danh mục',
    // Resume Builder
    resumeMe: 'ResumeMe',
    downloadPdf: 'Tải PDF',
    profile: 'Hồ sơ',
    work: 'Công việc',
    projects: 'Dự án',
    education: 'Học vấn',
    skills: 'Kỹ năng',
    strengths: 'Điểm mạnh',
    personalInformation: 'Thông tin cá nhân',
    fullName: 'Họ và tên',
    jobTitle: 'Chức danh',
    email: 'Email',
    phone: 'Điện thoại',
    location: 'Địa chỉ',
    website: 'Website',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    selfSummary: 'Tóm tắt bản thân',
    workExperience: 'Kinh nghiệm làm việc',
    company: 'Công ty',
    position: 'Vị trí',
    startDate: 'Ngày bắt đầu',
    endDate: 'Ngày kết thúc',
    description: 'Mô tả',
    add: 'Thêm',
    projectName: 'Tên dự án',
    date: 'Ngày',
    link: 'Liên kết',
    school: 'Trường',
    schoolUniversity: 'Trường/Đại học',
    degree: 'Bằng cấp',
    datePeriod: 'Ngày/Thời gian',
    present: 'Hiện tại',
    selfSummaryPlaceholder: 'Viết một bản tóm tắt ngắn về nền tảng chuyên môn của bạn...',
    workDescriptionPlaceholder: 'Mô tả trách nhiệm và thành tựu của bạn...',
    projectDescriptionPlaceholder: 'Mô tả dự án và đóng góp của bạn...',
    schoolPlaceholder: 'Tên trường đại học',
    degreePlaceholder: 'Cử nhân khoa học về...',
    enterSkills: 'Nhập kỹ năng cách nhau bằng dấu phẩy',
    skillsExample: 'Ví dụ: JavaScript, TypeScript, React, Node.js, Python, AWS, Docker',
    skillsPreview: 'Xem trước:',
    enterStrengths: 'Nhập điểm mạnh cách nhau bằng dấu phẩy',
    strengthsExample: 'Ví dụ: Khả năng giải quyết vấn đề tốt, Kỹ năng giao tiếp xuất sắc, Làm việc nhóm tốt',
    strengthsPreview: 'Xem trước:',
    noEducationYet: 'Chưa có học vấn nào. Nhấn "Thêm" để thêm.',
    // Certifications
    certifications: 'Chứng chỉ',
    certificationName: 'Tên chứng chỉ',
    issuer: 'Tổ chức cấp',
    issueDate: 'Ngày cấp',
    expirationDate: 'Ngày hết hạn',
    credentialId: 'Mã chứng chỉ',
    credentialUrl: 'URL xác minh',
    certificationDescription: 'Mô tả',
    noCertificationsYet: 'Chưa có chứng chỉ. Nhấn "Thêm" để thêm mới.',
  },
};

function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'vi') {
      return saved;
    }
  }
  return 'vi';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // getInitialLanguage() handles localStorage read on mount

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: TranslationsKey): string => {
    return translations[language][key] || key;
  };

  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}