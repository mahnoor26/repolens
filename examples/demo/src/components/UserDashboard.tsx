import { useEffect, useState } from 'react';
import type { User } from '../services/users';

// This example intentionally contains findings. Run RepoLens to inspect them.
export function UserDashboard() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then(response => response.json())
      .then((data: any) => setUsers(data));
  }, []);

  return (
    <section>
      <h1>Customer directory</h1>
      <input placeholder="Search customers" />
      {users.map(user => (
        <article>
          <img src={user.avatar} />
          <h2>{user.name}</h2>
          <div onClick={() => console.log(user.id)}>View profile</div>
        </article>
      ))}
    </section>
  );
}
