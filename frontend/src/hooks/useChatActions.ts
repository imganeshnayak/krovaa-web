import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { Chat as ChatType } from '@/lib/api';
import { ChatMuteState, MuteDurationOption, isMuteActive, toChatMuteState } from '@/lib/chatMute';

type ChatActionQueueItem =
  | { id: string; type: 'delete'; chatId: string }
  | { id: string; type: 'mute'; chatId: string; payload: ChatMuteState }
  | { id: string; type: 'unmute'; chatId: string };

type UseChatActionsArgs = {
  clearChatHistory: (chatId: string) => Promise<any>;
  setChats: Dispatch<SetStateAction<ChatType[]>>;
  setSelectedChat: (chat: ChatType | null) => void;
  selectedChatId?: string;
};

const MUTE_STORAGE_KEY = 'chat_mute_settings_v1';
const ACTION_QUEUE_KEY = 'chat_action_queue_v1';

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readMuteStore(): Record<string, ChatMuteState> {
  return parseJson<Record<string, ChatMuteState>>(localStorage.getItem(MUTE_STORAGE_KEY), {});
}

function readQueueStore(): ChatActionQueueItem[] {
  return parseJson<ChatActionQueueItem[]>(localStorage.getItem(ACTION_QUEUE_KEY), []);
}

function writeMuteStore(value: Record<string, ChatMuteState>) {
  localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(value));
}

function writeQueueStore(value: ChatActionQueueItem[]) {
  localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(value));
}

function queueAction(item: ChatActionQueueItem) {
  const queue = readQueueStore();
  queue.push(item);
  writeQueueStore(queue);
}

function removeStaleMutedEntries(mutedMap: Record<string, ChatMuteState>) {
  const next = { ...mutedMap };
  let changed = false;

  Object.keys(next).forEach((chatId) => {
    if (!isMuteActive(next[chatId])) {
      delete next[chatId];
      changed = true;
    }
  });

  if (changed) {
    writeMuteStore(next);
  }

  return next;
}

export function useChatActions({ clearChatHistory, setChats, setSelectedChat, selectedChatId }: UseChatActionsArgs) {
  const [muteMap, setMuteMap] = useState<Record<string, ChatMuteState>>(() => {
    const raw = readMuteStore();
    return removeStaleMutedEntries(raw);
  });

  const isChatMuted = useCallback((chatId: string) => {
    const state = muteMap[chatId];
    return isMuteActive(state);
  }, [muteMap]);

  const upsertMuteState = useCallback((chatId: string, value: ChatMuteState) => {
    setMuteMap((prev) => {
      const next = { ...prev, [chatId]: value };
      writeMuteStore(next);
      return next;
    });
  }, []);

  const clearMuteState = useCallback((chatId: string) => {
    setMuteMap((prev) => {
      const next = { ...prev };
      delete next[chatId];
      writeMuteStore(next);
      return next;
    });
  }, []);

  const muteChat = useCallback((chatId: string, option: MuteDurationOption) => {
    const state = toChatMuteState(option);
    upsertMuteState(chatId, state);

    queueAction({
      id: `${Date.now()}_${chatId}_mute`,
      type: 'mute',
      chatId,
      payload: state,
    });
  }, [upsertMuteState]);

  const unmuteChat = useCallback((chatId: string) => {
    clearMuteState(chatId);

    queueAction({
      id: `${Date.now()}_${chatId}_unmute`,
      type: 'unmute',
      chatId,
    });
  }, [clearMuteState]);

  const deleteChat = useCallback(async (chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.chat_id !== chatId));
    if (selectedChatId === chatId) setSelectedChat(null);

    if (!navigator.onLine) {
      queueAction({ id: `${Date.now()}_${chatId}_delete`, type: 'delete', chatId });
      return;
    }

    try {
      await clearChatHistory(chatId);
    } catch (err) {
      // Roll back by forcing caller-side refresh if needed.
      throw err;
    }
  }, [clearChatHistory, selectedChatId, setChats, setSelectedChat]);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    const queue = readQueueStore();
    if (queue.length === 0) return;

    const remaining: ChatActionQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'delete') {
          await clearChatHistory(item.chatId);
        }
        if (item.type === 'mute') {
          // Mute is currently persisted locally only. Keep latest local state.
          upsertMuteState(item.chatId, item.payload);
        }
        if (item.type === 'unmute') {
          clearMuteState(item.chatId);
        }
      } catch {
        remaining.push(item);
      }
    }

    writeQueueStore(remaining);
  }, [clearChatHistory, upsertMuteState, clearMuteState]);

  useEffect(() => {
    flushQueue();
    const onOnline = () => {
      void flushQueue();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushQueue]);

  const mutedChatIds = useMemo(() => {
    return Object.keys(muteMap).filter((chatId) => isMuteActive(muteMap[chatId]));
  }, [muteMap]);

  return {
    muteMap,
    mutedChatIds,
    isChatMuted,
    muteChat,
    unmuteChat,
    deleteChat,
    flushQueue,
  };
}
