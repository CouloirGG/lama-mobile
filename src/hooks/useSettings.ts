import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LEAGUE_KEY = "@lama/league";
const DEFAULT_LEAGUE = "Fate of the Vaal";

export function useSettings() {
  const [league, setLeagueState] = useState(DEFAULT_LEAGUE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LEAGUE_KEY).then((stored) => {
      if (stored) setLeagueState(stored);
      setIsLoaded(true);
    });
  }, []);

  const setLeague = useCallback((value: string) => {
    setLeagueState(value);
    AsyncStorage.setItem(LEAGUE_KEY, value);
  }, []);

  return { league, setLeague, isLoaded };
}
