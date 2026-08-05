/**
 * Formats a date input (string, Date, etc.) into the day/month.year format (e.g. DD/MM.YYYY)
 */
export const formatDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formats a date/time into 12-hour time format with AM/PM (e.g. 02:30 PM, 11:15 AM)
 */
export const formatTime12h = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'N/A';
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${hoursStr}:${minutes} ${ampm}`;
};
