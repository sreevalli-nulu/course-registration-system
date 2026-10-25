import api from "./api";

export const loginUser = async (email, password) => {
  const body = new URLSearchParams();

  body.append("username", email);
  body.append("password", password);

  const response = await api.post("/auth/login", body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data;
};

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);

  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");

  return response.data;
};