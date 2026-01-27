export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  token: string;
  expiresAt: string;
  user: User;
}
