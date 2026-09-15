import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../services/users';

export function UserList() {
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers });
  return (
    <section>
      <label htmlFor="search">Search users</label>
      <input id="search" type="search" />
      {users.map(user => (
        <article key={user.id}>
          <h2>{user.name}</h2>
          <button type="button" onClick={() => console.log(user.id)}>View profile</button>
        </article>
      ))}
    </section>
  );
}
