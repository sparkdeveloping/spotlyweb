"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, usePlatform } from "@/components/firebase-provider";
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
import { getBusinessLifecycle } from "@/lib/business-lifecycle";
import { businessHref, businessSectionFromPath, isBusinessAccountSection } from "@/lib/business-routing";

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

function routeWithBusiness(pathname, searchParams, businessId) {
  const params = Object.fromEntries(new URLSearchParams(searchParams.toString()).entries());
  delete params.business;
  return businessHref(pathname, { businessId, ...params });
}

export function BusinessDataProvider({ children }) {
  const { user, memberships } = useAuth();
  const { settings: platformSettings } = usePlatform();
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
  const [loadedBusinessId, setLoadedBusinessId] = useState("");
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
    if (!user?.uid) {
      setBusinessChoices([]);
      setPortfolioLoading(false);
      return;
    }
    setPortfolioLoading(true);
    setPortfolioError("");
    try {
      const payload = await authenticatedFetch("/api/business/portfolio");
      setBusinessChoices(payload.businesses || []);
    } catch (reason) {
      setPortfolioError(reason?.message || "Your business portfolio could not be loaded.");
      setBusinessChoices([]);
    } finally {
      setPortfolioLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { refreshPortfolio(); }, [refreshPortfolio, memberships]);

  const businessIds = useMemo(() => businessChoices.map((item) => item.id), [businessChoices]);
  const selectedChoice = useMemo(() => businessChoices.find((item) => item.id === selectedBusinessId) || null, [businessChoices, selectedBusinessId]);
  const membership = memberships.find((item) => item.businessId === selectedBusinessId || item.businessIds?.includes(selectedBusinessId) || (selectedChoice?.organizationId && item.organizationId === selectedChoice.organizationId && item.role === "organization_owner")) || null;

  useEffect(() => {
    if (portfolioLoading) return;
    const availableIds = businessChoices.map((item) => item.id);
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
    const currentAllowed = availableIds.includes(selectedBusinessId) ? selectedBusinessId : "";
    const next = requestedBusinessId || currentAllowed || (availableIds.includes(stored) ? stored : availableIds[0]);
    if (next !== selectedBusinessId) setSelectedBusinessIdState(next);
    if (next) writeState("spotly-business-id", user, next, "local");

    const section = businessSectionFromPath(pathname);
    if (!requestedBusinessId && !isBusinessAccountSection(section) && pathname.startsWith("/business/") && next) {
      router.replace(routeWithBusiness(pathname, searchParams, next), { scroll: false });
    }
  }, [businessChoices, pathname, portfolioLoading, requestedBusinessId, router, searchParams, selectedBusinessId, user]);

  const setSelectedBusinessId = useCallback((nextId) => {
    const choice = businessChoices.find((item) => item.id === nextId);
    if (!choice) return;
    setSelectedBusinessIdState(nextId);
    writeState("spotly-business-id", user, nextId, "local");
    router.push(choice.defaultHref || businessHref("/business/launch", { businessId: nextId }));
  }, [businessChoices, router, user]);

  const branches = useMemo(() => {
    if (selectedChoice?.businessWide || canUseEveryBranch(membership) || !(membership?.branchIds || []).length) return allBranches;
    const allowed = new Set(membership.branchIds);
    return allBranches.filter((branch) => allowed.has(branch.id));
  }, [allBranches, membership, selectedChoice?.businessWide]);

  useEffect(() => {
    if (!selectedBusinessId) {
      setBusiness(null);
      setLoadedBusinessId("");
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
    setLoadedBusinessId("");
    writeState("spotly-business-id", user, selectedBusinessId, "local");
    const onError = (reason) => {
      setError(reason?.message || "Some business information could not be loaded.");
      setLoading(false);
    };
    const cleanups = [
      subscribeBusiness(selectedBusinessId, (value) => {
        setBusiness(value);
        setLoadedBusinessId(value?.id || "");
        setLoading(false);
      }, onError),
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
  const contextSwitching = Boolean(selectedBusinessId && loadedBusinessId !== selectedBusinessId);
  const lifecycle = useMemo(() => getBusinessLifecycle({
    business: loadedBusinessId === selectedBusinessId ? business || {} : {},
    branches: loadedBusinessId === selectedBusinessId ? branches : [],
    products: loadedBusinessId === selectedBusinessId ? products : [],
    claims: loadedBusinessId === selectedBusinessId ? claims : [],
    invitations: loadedBusinessId === selectedBusinessId ? invitations : [],
    members: loadedBusinessId === selectedBusinessId ? members : [],
    operations: loadedBusinessId === selectedBusinessId ? operations : defaultOperationalSettings,
    membership: loadedBusinessId === selectedBusinessId ? membership : null,
    selectedBusinessId,
    archetype,
    platformSettings
  }), [archetype, branches, business, claims, invitations, loadedBusinessId, members, membership, operations, platformSettings, products, selectedBusinessId]);
  const setupComplete = lifecycle.setup.complete;

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
    loadedBusinessId,
    contextSwitching,
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
    setupComplete,
    lifecycle
  }), [user, memberships, membership, businessIds, businessChoices, portfolioLoading, portfolioError, refreshPortfolio, selectedBusinessId, setSelectedBusinessId, business, loadedBusinessId, contextSwitching, allBranches, branches, selectedBranchId, selectedBranch, products, orders, claims, invitations, members, finance, operations, promotions, payouts, support, templates, loading, error, businessType, archetype, setupComplete, lifecycle]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinessWorkspace() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useBusinessWorkspace must be used inside BusinessDataProvider.");
  return value;
}
