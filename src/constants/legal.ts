export const FULL_COMPANY_NAME = 'USTATS TECH LIMITED';
export const COMPANY_NUMBER = '17235485';
export const PLACE_OF_REGISTRATION = 'Registered in England and Wales';
export const REGISTERED_OFFICE_ADDRESS = '110 Woodmansterne Road, London, SW16 5UQ';
export const SUPPORT_EMAIL = 'legal@ustats.pro';

export const getLegalPath = (subPath: string): string => {
  const pathname = window.location.pathname;
  const markers = [
    '/legal/', 
    '/login', 
    '/demo', 
    '/live/', 
    '/dashboard', 
    '/analytics', 
    '/roster', 
    '/lineup', 
    '/coach', 
    '/log',
    '/admin',
    '/team_selection'
  ];
  
  for (const marker of markers) {
    const index = pathname.indexOf(marker);
    if (index !== -1) {
      const base = pathname.substring(0, index);
      return `${base}${subPath}`;
    }
  }
  
  // Fallback for root path
  const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return `${cleanPath}${subPath}`;
};

