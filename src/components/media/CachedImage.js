import React from "react";
import { Image } from "react-native";
import useCachedMediaUri from "../../hooks/useCachedMediaUri";

export default function CachedImage({ source, ...props }) {
  const sourceUri = typeof source === "string" ? source : source?.uri;
  const cachedUri = useCachedMediaUri(sourceUri);
  const nextSource =
    source && typeof source === "object"
      ? { ...source, uri: cachedUri || sourceUri }
      : { uri: cachedUri || sourceUri };

  return <Image {...props} source={nextSource} />;
}
