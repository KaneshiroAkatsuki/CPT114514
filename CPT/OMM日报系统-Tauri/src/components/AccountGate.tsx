import * as React from "react";
import { FileSpreadsheet, KeyRound, LockKeyhole, RotateCcw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAccountManager } from "@/hooks/useSidecar";
import type { PublicAccount } from "@/types/record";
import { MainWindow } from "@/components/MainWindow";

type GateMode = "login" | "register" | "forgot";

function roleLabel(account: PublicAccount): string {
  return account.role === "admin" ? "管理员" : "访客";
}

function validatePin(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "PIN 必须是 4 到 6 位数字。";
  return null;
}

export function AccountGate() {
  const [accounts, setAccounts] = React.useState<PublicAccount[]>([]);
  const [currentAccount, setCurrentAccount] = React.useState<PublicAccount | null>(null);
  const [mode, setMode] = React.useState<GateMode>("login");
  const [login, setLogin] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [realName, setRealName] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [adminPin, setAdminPin] = React.useState("");
  const [targetAccountId, setTargetAccountId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const {
    loadAccounts,
    loginAccount,
    registerAccount,
    logoutAccount,
    resetAccountPin,
  } = useAccountManager();

  const refreshAccounts = React.useCallback(async () => {
    const info = await loadAccounts();
    setAccounts(info.accounts);
    if (info.current_account) {
      setCurrentAccount(info.current_account);
    }
    if (!targetAccountId && info.accounts.length > 0) {
      const firstGuest = info.accounts.find((account) => account.role !== "admin") || info.accounts[0];
      setTargetAccountId(firstGuest.id);
    }
    if (!login && info.accounts.length > 0) {
      setLogin(info.accounts[0].nickname);
    }
  }, [loadAccounts, login, targetAccountId]);

  React.useEffect(() => {
    refreshAccounts()
      .catch((e) => setError(`账户读取失败: ${e}`))
      .finally(() => setLoading(false));
  }, [refreshAccounts]);

  const resetFormState = () => {
    setPin("");
    setNewPin("");
    setAdminPin("");
    setError("");
    setMessage("");
  };

  const handleLogin = async () => {
    setError("");
    setMessage("");
    if (!login.trim()) {
      setError("请输入昵称或真实姓名。");
      return;
    }
    const pinError = validatePin(pin);
    if (pinError) {
      setError(pinError);
      return;
    }
    setWorking(true);
    try {
      const session = await loginAccount(login.trim(), pin.trim());
      setCurrentAccount(session.account);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    setMessage("");
    if (!nickname.trim() || !realName.trim()) {
      setError("昵称和真实姓名都不能为空。");
      return;
    }
    const pinError = validatePin(newPin);
    if (pinError) {
      setError(pinError);
      return;
    }
    setWorking(true);
    try {
      const session = await registerAccount(nickname.trim(), realName.trim(), newPin.trim());
      setCurrentAccount(session.account);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  };

  const handleResetPin = async () => {
    setError("");
    setMessage("");
    const target = accounts.find((account) => account.id === targetAccountId);
    if (!target) {
      setError("请选择要重置的账户。");
      return;
    }
    const pinError = validatePin(newPin);
    if (pinError) {
      setError(pinError);
      return;
    }
    const adminPinError = validatePin(adminPin);
    if (adminPinError) {
      setError(`管理员 ${adminPinError}`);
      return;
    }
    setWorking(true);
    try {
      await resetAccountPin(target.id, adminPin.trim(), newPin.trim());
      setMessage(`已重置 ${target.nickname} 的 PIN。`);
      setMode("login");
      setLogin(target.nickname);
      setPin("");
      setNewPin("");
      setAdminPin("");
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  };

  const handleSwitchAccount = async () => {
    setWorking(true);
    try {
      await logoutAccount();
      setCurrentAccount(null);
      setMode("login");
      resetFormState();
      await refreshAccounts();
    } catch (e) {
      setError(`退出登录失败: ${e}`);
    } finally {
      setWorking(false);
    }
  };

  if (currentAccount) {
    return (
      <MainWindow
        currentAccount={currentAccount}
        onAccountUpdated={setCurrentAccount}
        onSwitchAccount={handleSwitchAccount}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f7] text-sm text-slate-500">
        正在读取账户...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-slate-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="app-surface flex items-center gap-3 rounded-2xl px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-[0_10px_24px_rgba(10,132,255,0.24)]">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight tracking-normal">OMM 日报系统</h1>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Kaneshiro · 禹欣
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5">
          <Card className="overflow-hidden rounded-2xl border-white/70 bg-white/85">
            <CardHeader className="border-b border-slate-200/70 bg-white/70 px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                {mode === "login" && <LockKeyhole className="h-4 w-4 text-blue-600" />}
                {mode === "register" && <UserPlus className="h-4 w-4 text-blue-600" />}
                {mode === "forgot" && <RotateCcw className="h-4 w-4 text-blue-600" />}
                {mode === "login" ? "登录账户" : mode === "register" ? "注册员工账户" : "重置 PIN"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm leading-6 text-red-800">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-lg border border-green-200 bg-green-50/90 px-3 py-2 text-sm leading-6 text-green-800">
                  {message}
                </div>
              )}

              {mode === "login" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="field-label">昵称或真实姓名</label>
                    <Input value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Kaneshiro 或 禹欣" />
                  </div>
                  <div className="space-y-2">
                    <label className="field-label">PIN</label>
                    <Input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} type="password" placeholder="4-6 位数字" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { resetFormState(); setMode("forgot"); }}>
                      忘记 PIN
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => { resetFormState(); setMode("register"); }}>
                        注册
                      </Button>
                      <Button onClick={handleLogin} disabled={working}>
                        <KeyRound className="mr-1.5 h-4 w-4" />
                        登录
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {mode === "register" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="field-label">昵称</label>
                      <Input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="例如 Kaneshiro" />
                    </div>
                    <div className="space-y-2">
                      <label className="field-label">真实姓名</label>
                      <Input value={realName} onChange={(event) => setRealName(event.target.value)} placeholder="例如 禹欣" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="field-label">设置 PIN</label>
                    <Input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))} type="password" placeholder="4-6 位数字" />
                    <p className="form-hint">新员工默认为访客账户，管理员功能不会显示。</p>
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button variant="outline" onClick={() => { resetFormState(); setMode("login"); }}>
                      返回登录
                    </Button>
                    <Button onClick={handleRegister} disabled={working}>
                      注册并登录
                    </Button>
                  </div>
                </div>
              )}

              {mode === "forgot" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="field-label">要重置的账户</label>
                    <select
                      value={targetAccountId}
                      onChange={(event) => setTargetAccountId(event.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200/90 bg-white/80 px-3 py-1 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.nickname} / {account.real_name}（{roleLabel(account)}）
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="field-label">管理员 PIN</label>
                      <Input value={adminPin} onChange={(event) => setAdminPin(event.target.value.replace(/\D/g, "").slice(0, 6))} type="password" placeholder="管理员 PIN" />
                    </div>
                    <div className="space-y-2">
                      <label className="field-label">新 PIN</label>
                      <Input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))} type="password" placeholder="4-6 位数字" />
                    </div>
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button variant="outline" onClick={() => { resetFormState(); setMode("login"); }}>
                      返回登录
                    </Button>
                    <Button onClick={handleResetPin} disabled={working}>
                      重置 PIN
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
