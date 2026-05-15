import { useCallback, useEffect, useState } from "react";

export default function useAsyncResource(loader, initialValue) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await loader();
      setData(result);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (mounted) {
          setData(result);
        }
      })
      .catch((requestError) => {
        if (mounted) {
          setError(requestError);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loader]);

  return { data, setData, loading, error, reload };
}
