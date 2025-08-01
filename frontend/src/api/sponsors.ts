interface Sponsor {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

export async function fetchSponsors(): Promise<Sponsor[]> {
  try {
    const response = await fetch('/api/sponsors');
    if (!response.ok) {
      throw new Error('Failed to fetch sponsors');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching sponsors:', error);
    return [];
  }
} 
