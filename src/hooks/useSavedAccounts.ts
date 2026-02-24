import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedAccount, SavedCharacter } from "../types";

const STORAGE_KEY = "@lama/saved_accounts";

export function useSavedAccounts() {
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  // Load on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed: SavedAccount[] = JSON.parse(raw);
          // Sort by lastUsed descending
          parsed.sort((a, b) => b.lastUsed - a.lastUsed);
          setSavedAccounts(parsed);
        } catch {
          // corrupt data — start fresh
        }
      }
    });
  }, []);

  const persist = useCallback(async (accounts: SavedAccount[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch (err) {
      console.warn("Failed to persist saved accounts:", err);
    }
  }, []);

  const saveCharacter = useCallback(
    (
      accountName: string,
      char: { name: string; class: string; level: number },
      league: string
    ) => {
      setSavedAccounts((prev) => {
        const next = [...prev];
        let account = next.find(
          (a) => a.accountName.toLowerCase() === accountName.toLowerCase()
        );

        const savedChar: SavedCharacter = {
          name: char.name,
          class: char.class,
          level: char.level,
          league,
          lastLookup: Date.now(),
        };

        if (account) {
          // Upsert character
          const existingIdx = account.characters.findIndex(
            (c) => c.name.toLowerCase() === char.name.toLowerCase()
          );
          if (existingIdx >= 0) {
            account.characters[existingIdx] = savedChar;
          } else {
            account.characters.push(savedChar);
          }
          account.lastUsed = Date.now();
        } else {
          // New account
          account = {
            accountName,
            characters: [savedChar],
            lastUsed: Date.now(),
          };
          next.push(account);
        }

        // Sort by lastUsed descending
        next.sort((a, b) => b.lastUsed - a.lastUsed);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeSavedAccount = useCallback(
    (accountName: string) => {
      setSavedAccounts((prev) => {
        const next = prev.filter(
          (a) => a.accountName.toLowerCase() !== accountName.toLowerCase()
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeSavedCharacter = useCallback(
    (accountName: string, charName: string) => {
      setSavedAccounts((prev) => {
        const next = prev.map((a) => {
          if (a.accountName.toLowerCase() !== accountName.toLowerCase()) return a;
          return {
            ...a,
            characters: a.characters.filter(
              (c) => c.name.toLowerCase() !== charName.toLowerCase()
            ),
          };
        });
        // Remove accounts with no characters left
        const filtered = next.filter((a) => a.characters.length > 0);
        persist(filtered);
        return filtered;
      });
    },
    [persist]
  );

  const getAccountCharacters = useCallback(
    (accountName: string, league?: string): SavedCharacter[] => {
      const account = savedAccounts.find(
        (a) => a.accountName.toLowerCase() === accountName.toLowerCase()
      );
      if (!account) return [];
      if (!league) return account.characters;
      return account.characters.filter((c) => c.league === league);
    },
    [savedAccounts]
  );

  return {
    savedAccounts,
    saveCharacter,
    removeSavedAccount,
    removeSavedCharacter,
    getAccountCharacters,
  };
}
