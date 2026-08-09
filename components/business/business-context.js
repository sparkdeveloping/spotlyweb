"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/firebase-provider";
import {
  subscribeBranches,
  subscribeBusiness,
  subscribeBusinessCatalog,
  subscribeBusinessClaimsForBusiness,
  subscribeBusinessFinanceSettings,
  subscribeBusinessInvitations,
  subscribeOrdersForBusiness,
  subscribeSupportConversations
} from "@/lib/firebase-services";
import {
  subscribeBusinessMembers,
  subscribeBusinessOperationalSettings,
  subscribeBusinessPayouts,
  subscribeCatalogTemplates,
  subscribePromotions
} from "@/lib/business-services";
import { authenticatedFetch } from "@/lib/api-client";
import { defaultOperationalSettings } from "@/data/business-config";
import { businessArchetype, inferBusinessType } from "@/data/business-archetypes";
import { readState, writeState } from "@/lib/browser-state";

const BusinessContext = createContext(null);

function canUseEveryBranch(membership) {
  const role = membership?.role || "";
  const permissions = membership?.permissions || [];
  return ["organization_owner", "business_owner", "business_manager"].includes(role)
    || permissions.includes("*")
    || permissions.includes("organization.*")
    || permissions.includes("businesses.*")
    || permissions.includes("branches.*");
}

function queryWithBusiness(pathname, searchParams, businessId) {
  const params = new URLSearchParams(searchParams.toString());
  if (businessId) params.set("business", businessId); else params.delete("business");
  return `${pathname}${params.size ? `?${params.toString()}` : ""}`;
}

export function BusinessDataProvider({ children }) {
  const { user, memberships } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedBusinessId = searchParams.get("business") || "";
  const [businessChoices, setBusinessChoices] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");
  const [selectedBusinessId, setSelectedBusinessIdState] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [business, setBusiness] = useState(null);
  const [allBranches, setAllBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [claims, setClaims] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [members, setMembers] = useState([]);
  const [finance, setFinance] = useState(null);
  const [operations, setOperations] = useState(defaultOperationalSettings);
  const [promotions, setPromotions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [support, setSupport] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshPortfolio = useCallback(async () => {
    if (!user?.uid) return;
    setPortfolioLoading(true);
    setPortfolioError("");
    try {
      const payload = await authenticatedFetch("/api/business/portfolio");
      const choices = payload.businesses || [];
      setBusinessChoices(choices);
      const availableIds = choices.map((item) => item.id);
      if (!availableIds.length) {
        setSelectedBusinessIdState("");
        return;
      }
      if (requestedBusinessId && !availableIds.includes(requestedBusinessId)) {
        setSelectedBusinessIdState("");
        setPortfolioError("This account does not currently have access to the business in this link.");
        return;
      }
      const stored = readState("spotly-business-id", user, "", "local");
      const next = requestedBusinessId || (availableIds.includes(stored) ? stored : availableIds[0]);
      setSelectedBusinessIdState(next);
      if (!requestedBusinessId && pathname.startsWith("/business/") && next) {
        router.replace(queryWithBusiness(pathname, searchParams, next));
      }
    } catch (reason) {
      setPortfolioError(reason?.message || "Your business portfolio could not be loaded.");
      setBusinessChoices([]);
      setSelectedBusinessIdState("");
    } finally {
      setPortfolioLoading(false);
    }
  }, [pathname, requestedBusinessId, router, searchParams, user]);

  useEffect(() => { refreshPortfolio(); }, [refreshPortfolio, memberships]);

  const businessIds = useMemo(() => businessChoices.map((item) => item.id), [businessChoices]);
  const selectedChoice = useMemo(() => businessChoices.find((item) => item.id === selectedBusinessId) || null, [businessChoices, selectedBusinessId]);
  const membership = memberships.find((item) => item.businessId === selectedBusinessId || item.businessIds?.includes(selectedBusinessId) || (selectedChoice?.organizationId && item.organizationId === selectedChoice.organizationId && item.role === "organization_owner")) || null;

  const setSelectedBusinessId = useCallback((nextId) => {
    if (!businessChoices.some((item) => item.id === nextId)) return;
    setSelectedBusinessIdState(nextId);
    writeState("spotly-business-id", user, nextId, "local");
    router.push(queryWithBusiness(pathname, searchParams, nextId));
  }, [businessChoices, pathname, router, searchParams, user]);

  const branches = useMemo(() => {
    if (selectedChoice?.businessWide || canUseEveryBranch(membership) || !(membership?.branchIds || []).length) return allBranches;
    const allowed = new Set(membership.branchIds);
    return allBranches.filter((branch) => allowed.has(branch.id));
  }, [allBranches, membership, selectedChoice?.businessWide]);

  useEffect(() => {
    if (!selectedBusinessId) {
      setBusiness(null);
      setAllBranches([]);
      setSelectedBranchId("");
      setProducts([]);
      setOrders([]);
      setClaims([]);
      setInvitations([]);
      setMembers([]);
      setFinance(null);
      setOperations(defaultOperationalSettings);
      setPromotions([]);
      setPayouts([]);
      setSupport([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");
    writeState("spotly-business-id", user, selectedBusinessId, "local");
    const onError = (reason) => {
      setError(reason?.message || "Some business information could not be loaded.");
      setLoading(false);
    };
    const cleanups = [
      subscribeBusiness(selectedBusinessId, (value) => { setBusiness(value); setLoading(false); }, onError),
      subscribeBranches(selectedBusinessId, setAllBranches, onError),
      subscribeBusinessCatalog(selectedBusinessId, setProducts, onError),
      subscribeOrdersForBusiness(selectedBusinessId, setOrders, onError),
      subscribeBusinessClaimsForBusiness(selectedBusinessId, setClaims, onError),
      subscribeBusinessInvitations(selectedBusinessId, setInvitations, onError),
      subscribeBusinessMembers(selectedBusinessId, setMembers, onError),
      subscribeBusinessFinanceSettings(selectedBusinessId, setFinance, onError),
      subscribeBusinessOperationalSettings(selectedBusinessId, (value) => setOperations({ ...defaultOperationalSettings, ...(value || {}) }), onError),
      subscribePromotions(selectedBusinessId, setPromotions, onError),
      subscribeBusinessPayouts(selectedBusinessId, setPayouts, onError),
      subscribeSupportConversations(setSupport, { businessId: selectedBusinessId, onError })
    ];
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [selectedBusinessId, user]);

  useEffect(() => {
    if (!branches.length) { setSelectedBranchId(""); return; }
    const storageKey = `spotly-branch-id:${selectedBusinessId}`;
    const stored = readState(storageKey, user, "", "local");
    const next = branches.some((branch) => branch.id === stored) ? stored : branches[0].id;
    setSelectedBranchId((current) => branches.some((branch) => branch.id === current) ? current : next);
  }, [branches, selectedBusinessId, user]);

  useEffect(() => {
    if (selectedBusinessId && selectedBranchId) writeState(`spotly-branch-id:${selectedBusinessId}`, user, selectedBranchId, "local");
  }, [selectedBusinessId, selectedBranchId, user]);

  useEffect(() => subscribeCatalogTemplates(setTemplates, () => {}), []);

  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === selectedBranchId) || branches[0] || null, [branches, selectedBranchId]);
  const businessType = inferBusinessType(business || {});
  const archetype = businessArchetype(business || {});
  const setupComplete = Boolean(business?.onboarding?.completedAt || business?.onboardingStatus === "complete");
  const value = useMemo(() => ({
    user,
    memberships,
    membership,
    businessIds,
    businessChoices,
    portfolioLoading,
    portfolioError,
    refreshPortfolio,
    selectedBusinessId,
    setSelectedBusinessId,
    business,
    allBranches,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    products,
    orders,
    claims,
    invitations,
    members,
    finance,
    operations,
    promotions,
    payouts,
    support,
    templates,
    loading,
    error: error || portfolioError,
    businessType,
    archetype,
    setupComplete
  }), [user, memberships, membership, businessIds, businessChoices, portfolioLoading, portfolioError, refreshPortfolio, selectedBusinessId, setSelectedBusinessId, business, allBranches, branches, selectedBranchId, selectedBranch, products, orders, claims, invitations, members, finance, operations, promotions, payouts, support, templates, loading, error, businessType, archetype, setupComplete]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinessWorkspace() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useBusinessWorkspace must be used inside BusinessDataProvider.");
  return value;
}
