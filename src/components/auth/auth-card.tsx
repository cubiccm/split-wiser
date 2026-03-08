"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

interface AuthCardProps {
  onSuccess: (user: { id: number; name: string; email: string }) => void;
}

export function AuthCard({ onSuccess }: AuthCardProps) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">SplitWiser</CardTitle>
        <CardDescription>
          Sign in or create an account to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-4">
            <LoginForm onSuccess={onSuccess} />
          </TabsContent>
          <TabsContent value="register" className="pt-4">
            <RegisterForm onSuccess={onSuccess} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
