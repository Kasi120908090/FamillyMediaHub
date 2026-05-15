import { useProfile } from "../context/ProfileContext";

export function useAuth() {
  return useProfile();
}
