"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/firebase-provider";
import {
  getBusiness,
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
import { defaultOperationalSettings } from "@/data/business-config";
import { businessArchetype, inferBusinessType } from "@/data/business-archetypes";
import { readState, writeState } from "@/lib/browser-state";

const BusinessContext = createContext(null);

function uniqueBusinessIds(memberships) {
  const ids = new Set();
  memberships.forEach((membership) => {
    if (membership.businessId) ids.add(membership.businessId);
    (membership.businessIds || []).forEach((id) => ids.add(id));
  });
  return [...ids];
}

function canUseEveryBranch(membership) {
  const role = membership?.role || "";
  const permissions = membership?.permissions || [];
  return ["organization_owner", "business_owner", "business_manager"].includes(role)
    || permissions.includes("*")
    || permissions.includes("organization.*")
    || permissions.includes("businesses.*")
    || permissions.includes("branches.*");
}

export function BusinessDataProvider({ children }) {
  const { user, memberships } = useAuth();
  const businessIds = useMemo(() => uniqueBusinessIds(memberships), [memberships]);
  const businessIdsKey = useMemo(() => businessIds.join("|"), [businessIds]);
  const [businessChoices, setBusinessChoices] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
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

  useEffect(() => {
    if (!businessIds.length) {
      setBusinessChoices([]);
      setSelectedBusinessId("");
      return undefined;
    }
    let active = true;
    Promise.all(businessIds.map(async (id) => {
      try { return await getBusiness(id); } catch { return null; }
    })).then((items) => {
      if (!active) return;
      const choices = items.filter((item) => item && item.status !== "archived");
      setBusinessChoices(choices);
      const stored = readState("spotly-business-id", user, "", "local");
      const availableIds = choices.map((item) => item.id);
      const next = availableIds.includes(stored) ? stored : availableIds[0] || businessIds[0];
      setSelectedBusinessId((current) => availableIds.includes(current) ? current : next);
    });
    return () => { active = false; };
  }, [businessIds, businessIdsKey, user]);

  const membership = useMemo(() => memberships.find((item) => item.businessId === selectedBusinessId || item.businessIds?.includes(selectedBusinessId)) || null, [memberships, selectedBusinessId]);
  const branches = useMemo(() => {
    if (canUseEveryBranch(membership) || !(membership?.branchIds || []).length) return allBranches;
    const allowed = new Set(membership.branchIds);
    return allBranches.filter((branch) => allowed.has(branch.id));
  }, [allBranches, membership]);

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
      subscribeBusiness(selectedBusinessId, (value) => {
        setBusiness(value);
        setBusinessChoices((current) => {
          if (!value) return current;
          const exists = current.some((item) => item.id === value.id);
          return exists ? current.map((item) => item.id === value.id ? value : item) : [...current, value];
        });
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
    if (!branches.length) {
      setSelectedBranchId("");
      return;
    }
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
    error,
    businessType,
    archetype,
    setupComplete
  }), [user, memberships, membership, businessIds, businessChoices, selectedBusinessId, business, allBranches, branches, selectedBranchId, selectedBranch, products, orders, claims, invitations, members, finance, operations, promotions, payouts, support, templates, loading, error, businessType, archetype, setupComplete]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinessWorkspace() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useBusinessWorkspace must be used inside BusinessDataProvider.");
  return value;
}
