import { useState } from "react";

export function useModelData() {
  const [model] = useState<null>(null);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  return { model, loading, error };
}
