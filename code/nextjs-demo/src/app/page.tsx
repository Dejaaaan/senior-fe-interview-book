import Link from "next/link";

async function getStats(): Promise<{ users: number; posts: number }> {
  // Pretend this is a DB call. In a real app, await db.user.count(), etc.
  await new Promise((r) => setTimeout(r, 50));
  return { users: 1024, posts: 78 };
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <main>
      <h1>Next.js App Router demo</h1>
      <p>Server component fetched stats: {stats.users} users, {stats.posts} posts.</p>
      <ul>
        <li><Link href="/posts">View posts (Suspense + streaming)</Link></li>
        <li><Link href="/posts/new">New post (Server Action)</Link></li>
      </ul>
    </main>
  );
}
