// lib/tmdb.ts
const TMDB_KEY = process.env.TMDB_API_KEY

export interface TmdbMeta {
  title?: string; year?: string; backdrop?: string; imdb_id?: string
  tmdb_id?: string; genres?: string; type?: string; rating?: string
}

function mapTmdb(data: Record<string, unknown>, type: string): TmdbMeta {
  const backdrop = data.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : undefined
  const genres = (data.genres as { name: string }[] || []).map(g => g.name).join(' | ')
  return {
    title: (data.title || data.name) as string,
    year: ((data.release_date || data.first_air_date) as string)?.slice(0, 4),
    backdrop, genres,
    rating: (data.vote_average as number)?.toFixed(1),
    tmdb_id: String(data.id),
    imdb_id: data.imdb_id as string,
    type,
  }
}

export async function fetchTmdbFromImdb(imdbId: string): Promise<TmdbMeta | null> {
  if (!TMDB_KEY) return null
  try {
    const res = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`)
    const data = await res.json()
    const movie = data.movie_results?.[0]
    const tv = data.tv_results?.[0]
    if (movie) return mapTmdb(movie, 'movie')
    if (tv) return mapTmdb(tv, 'tv')
    return null
  } catch { return null }
}

export async function fetchTmdbDirectly(id: string, type: 'movie' | 'tv'): Promise<TmdbMeta | null> {
  if (!TMDB_KEY) return null
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}`)
    if (!res.ok) return null
    const data = await res.json()
    return mapTmdb(data, type)
  } catch { return null }
}
