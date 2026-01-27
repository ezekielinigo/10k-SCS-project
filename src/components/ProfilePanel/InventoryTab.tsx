import React from "react"
import SelectionPanel from "./SelectionPanel"
import InventoryList from "./InventoryList"
import EquipSlotsRow from "./EquipSlotsRow"

export default function InventoryTab() {
  return (
    <>
      <SelectionPanel />
      <InventoryList />
      <EquipSlotsRow />
    </>
  )
}
