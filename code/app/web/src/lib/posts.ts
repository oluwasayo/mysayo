import { getCollection } from 'astro:content'

export const getPublishedPosts = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  return posts.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  )
}
