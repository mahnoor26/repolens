export interface User {
  id: string;
  name: string;
  avatar: string;
}

export async function getUsers(): Promise<User[]> {
  const response = await fetch('/api/users');
  if (!response.ok) throw new Error('Unable to load users');
  return response.json();
}
