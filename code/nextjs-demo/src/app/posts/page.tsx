import { Suspense } from "react";

async function getSlowPosts() {
  await new Promise((r) => setTimeout(r, 1500));
  return [
    { id: "1", title: "First post" },
    { id: "2", title: "Second post" },
  ];
}

async function PostList() {
  const posts = await getSlowPosts();
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  );
}

export default function PostsPage() {
  return (
    <main>
      <h1>Posts</h1>
      <p>The list streams in once the server resolves it.</p>
      <Suspense fallback={<p>Loading posts…</p>}>
        <PostList />
      </Suspense>
    </main>
  );
}
