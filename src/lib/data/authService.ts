import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { UserProfileData, UserRole } from '../../types';
import { userService } from './userService';
import { checkIsAdminEmail } from '../authUtils';

export interface AuthResult {
  user: User;
  profile: UserProfileData;
  role: UserRole;
  isAdmin: boolean;
}

type AuthCallback = (user: User | null, isAdmin: boolean, profile: UserProfileData | null) => void;

export const authService = {
  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) throw new Error('يرجى إدخال البريد الإلكتروني.');
    if (!auth) throw new Error('تعذر الاتصال بخدمة التحقق.');
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err?.code === 'auth/user-not-found') {
        throw new Error('لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.');
      }
      throw new Error(err?.message || 'تعذر إرسال رابط إعادة تعيين كلمة المرور.');
    }
  },

  /**
   * Sign in or register instantly with Google
   */
  async signInWithGoogle(): Promise<AuthResult> {
    if (!auth || !db) throw new Error('تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.');

    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Authoritative profile sync (preserves existing admin roles and phone/address)
      const profile = await userService.syncUserProfile(user);
      const isAdmin = profile.role === 'admin';

      return {
        user,
        profile,
        role: profile.role,
        isAdmin
      };
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        throw new Error('تم إلغاء نافذة تسجيل الدخول عبر Google.');
      }
      console.error('Google sign in error:', err);
      throw new Error(err?.message || 'تعذر تسجيل الدخول باستخدام Google، حاول مرة أخرى.');
    }
  },

  /**
   * Sign in with Email and Password (for customer or admin)
   */
  async signIn(email: string, pass: string): Promise<AuthResult> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      throw new Error('يرجى إدخال البريد الإلكتروني.');
    }
    if (!pass || pass.trim().length === 0) {
      throw new Error('يرجى إدخال كلمة المرور.');
    }

    if (!auth || !db) throw new Error('تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.');

    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
      const user = cred.user;

      const profile = await userService.syncUserProfile(user);
      const isAdmin = profile.role === 'admin';

      return {
        user,
        profile,
        role: profile.role,
        isAdmin
      };
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        throw new Error('تسجيل الدخول بالبريد وكلمة المرور غير مفعل في Firebase. يرجى استخدام زر "تسجيل الدخول بحساب Google" المباشر.');
      }
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      }
      console.error('Sign in error:', err);
      throw new Error(err?.message || 'تعذر تسجيل الدخول، حاول مرة أخرى.');
    }
  },

  /**
   * Register a new customer account with Email and Password
   */
  async signUp(email: string, pass: string, displayName?: string): Promise<AuthResult> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) throw new Error('يرجى إدخال البريد الإلكتروني.');
    if (!pass || pass.length < 6) throw new Error('كلمة المرور يجب أن لا تقل عن 6 أحرف.');

    if (!auth || !db) throw new Error('تعذر الاتصال بقاعدة البيانات.');

    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      const user = cred.user;

      if (displayName && displayName.trim()) {
        try {
          await updateProfile(user, { displayName: displayName.trim() });
        } catch (e) {
          console.warn('Could not set displayName on auth user:', e);
        }
      }

      const profile = await userService.syncUserProfile(user, 'customer');
      return {
        user,
        profile,
        role: profile.role,
        isAdmin: profile.role === 'admin'
      };
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new Error('البريد الإلكتروني المدخل غير صالح.');
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.');
      }
      console.error('Sign up error:', err);
      throw new Error(err?.message || 'تعذر إنشاء الحساب، حاول مرة أخرى.');
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Firebase signOut error:', e);
        throw new Error('تعذر تسجيل الخروج.');
      }
    }
  },

  /**
   * Verify if a user is an admin
   */
  async verifyAdminAccess(user: User | null): Promise<boolean> {
    if (!user) return false;
    if (checkIsAdminEmail(user.email)) return true;

    try {
      const profile = await userService.getUserProfile(user.uid);
      return profile?.role === 'admin';
    } catch (e) {
      console.warn('Admin access check error:', e);
      return false;
    }
  },

  /**
   * Global Auth State observer with unified profile
   */
  subscribeToAuthState(callback: AuthCallback): () => void {
    if (auth) {
      try {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            callback(null, false, null);
            return;
          }

          try {
            // Fetch or sync profile
            let profile = await userService.getUserProfile(user.uid);
            if (!profile) {
              profile = await userService.syncUserProfile(user);
            }
            const isAdmin = user.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22' || checkIsAdminEmail(user.email) || profile.role === 'admin';
            callback(user, isAdmin, profile);
          } catch (err) {
            console.warn('Error resolving user auth profile:', err);
            const fallbackIsAdmin = user.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22' || checkIsAdminEmail(user.email);
            callback(user, fallbackIsAdmin, null);
          }
        });
        return unsubscribe;
      } catch (e) {
        console.error('onAuthStateChanged subscription error:', e);
      }
    }

    setTimeout(() => callback(null, false, null), 0);
    return () => {};
  }
};
