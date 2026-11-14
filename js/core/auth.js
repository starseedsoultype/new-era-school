export async function requireLogin(client, panel) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  panel.hidden = false;
  const form = panel.querySelector("#sign-in");
  const status = panel.querySelector("[role=status]");

  return new Promise(resolve => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      button.disabled = true;
      status.textContent = "";
      try {
        const result = await client.auth.signInWithPassword({
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
        });
        if (result.error || !result.data.session) throw new Error();
        panel.hidden = true;
        resolve(result.data.session);
      } catch {
        status.textContent = "The email or password is not right. Try again.";
      } finally {
        button.disabled = false;
      }
    });
  });
}
