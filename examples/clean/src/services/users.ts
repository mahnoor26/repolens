interface User { id: string; name: string }
export async function getUsers(): Promise<User[]> {
  const response = await fetch('/api/users');
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}
