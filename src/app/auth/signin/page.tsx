'use client';
import { signIn } from 'next-auth/react';
import React from 'react';
export default function SignIn() {
    return (
        <div>
            <button onClick={() => signIn('google')}>Sign in with Google</button>
        </div>
    );
}
