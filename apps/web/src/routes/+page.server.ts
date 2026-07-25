import { getVideoCorpus } from "$lib/server/corpus";

import type { PageServerLoad } from "./$types";

export const load = (async () => {
  const manifest = await getVideoCorpus();
  return { manifest };
}) satisfies PageServerLoad;
