export function cleanHKPhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, '');
  return clean.startsWith('852') ? clean : `852${clean}`;
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${cleanHKPhone(phone)}?text=${encodeURIComponent(text)}`;
}
