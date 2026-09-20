Přidání druhé prodejny dříve vytvořilo nepohyblivý marker. Mapa nyní umožňuje přesun každé identifikované pobočky a předává její ID formuláři, takže přesun neovlivní jinou vybranou prodejnu. Po dokončení geokódování používá aktuální callback a zachovává přiřazení tras.

Součástí je drobná úprava horní lišty AI modulů pro notebookové rozlišení, kde se název a ovládání překrývaly.

Ověření: Playwright test skutečného formuláře s maketou Google Maps ověřuje přesun obou prodejen, změnu výběru během geokódování, cíle přepočítaných tras, ukládané souřadnice a přidání další prodejny. Prošel také desktopový a mobilní test AI motivu. Typecheck prošel. Databáze se nemění.
