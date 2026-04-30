"use client";

import { useEffect, useState } from "react";
import { getMeRequest } from "@/lib/auth-api";

export type CurrentUser = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  factory_id?: number | null;
  is_superuser?: boolean;
  is_active?: boolean;
  governorate?: string | null;
  city?: string | null;
  address_line?: string | null;
  address_notes?: string | null;
};

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);

    try {
      const result = await getMeRequest();

      if (result.ok) {
        setUser(result.data as CurrentUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { user, loading, refresh };
}
