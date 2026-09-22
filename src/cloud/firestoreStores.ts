/**
 * Firestore-backed storage. Every account owns one document tree:
 *
 *   users/{uid}                 the profile list and which one is open
 *   users/{uid}/budgets/{id}    one profile's budget (AppData)
 *
 * Security rules allow an account to read and write only its own tree.
 */
import { deleteDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { AppData } from '../domain/types';
import { migrate, type Repository } from '../state/repository';
import { emptyIndex, type ProfileIndex, type ProfileStore } from '../state/profiles';
import { firestore } from './firebase';

/** Firestore rejects `undefined`; JSON round-tripping drops those fields. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class FirestoreRepository implements Repository {
  constructor(
    private readonly uid: string,
    private readonly profileId: string,
  ) {}

  private ref() {
    return doc(firestore(), 'users', this.uid, 'budgets', this.profileId);
  }

  async load(): Promise<AppData | null> {
    const snap = await getDoc(this.ref());
    if (!snap.exists()) return null;
    const { updatedAt: _ignored, ...data } = snap.data();
    return migrate(data);
  }

  async save(data: AppData): Promise<void> {
    await setDoc(this.ref(), { ...plain(data), updatedAt: serverTimestamp() });
  }

  async clear(): Promise<void> {
    await deleteDoc(this.ref());
  }
}

export class FirestoreProfileStore implements ProfileStore {
  constructor(
    private readonly uid: string,
    private readonly email: string,
  ) {}

  private ref() {
    return doc(firestore(), 'users', this.uid);
  }

  async load(): Promise<ProfileIndex> {
    const snap = await getDoc(this.ref());
    if (!snap.exists()) return emptyIndex;
    const d = snap.data();
    return { profiles: Array.isArray(d.profiles) ? d.profiles : [], activeId: d.activeId ?? null };
  }

  async save(index: ProfileIndex): Promise<void> {
    await setDoc(this.ref(), { ...plain(index), email: this.email, updatedAt: serverTimestamp() });
  }

  async purge(profileId: string): Promise<void> {
    await deleteDoc(doc(firestore(), 'users', this.uid, 'budgets', profileId));
  }
}
