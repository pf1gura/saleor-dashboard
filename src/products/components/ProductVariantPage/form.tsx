import { getAttributesDisplayData } from "@saleor/attributes/utils/data";
import {
  createAttributeChangeHandler,
  createAttributeFileChangeHandler,
  createAttributeMultiChangeHandler,
  createAttributeReferenceChangeHandler,
  createAttributeValueReorderHandler,
  createFetchMoreReferencesHandler,
  createFetchReferencesHandler
} from "@saleor/attributes/utils/handlers";
import { ChannelPriceData, IChannelPriceArgs } from "@saleor/channels/utils";
import { AttributeInput } from "@saleor/components/Attributes";
import { MetadataFormData } from "@saleor/components/Metadata";
import { ProductVariant } from "@saleor/fragments/types/ProductVariant";
import useForm, { FormChange, SubmitPromise } from "@saleor/hooks/useForm";
import useFormset, {
  FormsetChange,
  FormsetData
} from "@saleor/hooks/useFormset";
import {
  getAttributeInputFromVariant,
  getStockInputFromVariant
} from "@saleor/products/utils/data";
import { getChannelsInput } from "@saleor/products/utils/handlers";
import {
  validateCostPrice,
  validatePrice
} from "@saleor/products/utils/validation";
import { SearchPages_search_edges_node } from "@saleor/searches/types/SearchPages";
import { SearchProducts_search_edges_node } from "@saleor/searches/types/SearchProducts";
import { SearchWarehouses_search_edges_node } from "@saleor/searches/types/SearchWarehouses";
import { FetchMoreProps, ReorderEvent } from "@saleor/types";
import { arrayDiff } from "@saleor/utils/arrays";
import { mapMetadataItemToInput } from "@saleor/utils/maps";
import getMetadata from "@saleor/utils/metadata/getMetadata";
import useMetadataChangeTrigger from "@saleor/utils/metadata/useMetadataChangeTrigger";
import React from "react";

import handleFormSubmit from "../../../utils/handlers/handleFormSubmit";
import { ProductStockInput } from "../ProductStocks";

export interface ProductVariantUpdateFormData extends MetadataFormData {
  sku: string;
  trackInventory: boolean;
  weight: string;
}
export interface ProductVariantUpdateData extends ProductVariantUpdateFormData {
  channelListings: FormsetData<ChannelPriceData, IChannelPriceArgs>;
  attributes: AttributeInput[];
  stocks: ProductStockInput[];
}
export interface ProductVariantUpdateSubmitData
  extends ProductVariantUpdateFormData {
  attributes: AttributeInput[];
  attributesWithNewFileValue: FormsetData<null, File>;
  addStocks: ProductStockInput[];
  channelListings: FormsetData<ChannelPriceData, IChannelPriceArgs>;
  updateStocks: ProductStockInput[];
  removeStocks: string[];
}

export interface UseProductVariantUpdateFormOpts {
  warehouses: SearchWarehouses_search_edges_node[];
  currentChannels: ChannelPriceData[];
  referencePages: SearchPages_search_edges_node[];
  referenceProducts: SearchProducts_search_edges_node[];
  fetchReferencePages?: (data: string) => void;
  fetchMoreReferencePages?: FetchMoreProps;
  fetchReferenceProducts?: (data: string) => void;
  fetchMoreReferenceProducts?: FetchMoreProps;
  assignReferencesAttributeId?: string;
}

export interface ProductVariantUpdateHandlers
  extends Record<
      | "changeStock"
      | "selectAttribute"
      | "selectAttributeMultiple"
      | "changeChannels",
      FormsetChange
    >,
    Record<"selectAttributeReference", FormsetChange<string[]>>,
    Record<"selectAttributeFile", FormsetChange<File>>,
    Record<"reorderAttributeValue", FormsetChange<ReorderEvent>>,
    Record<"addStock" | "deleteStock", (id: string) => void> {
  changeMetadata: FormChange;
  fetchReferences: (value: string) => void;
  fetchMoreReferences: FetchMoreProps;
}

export interface UseProductVariantUpdateFormResult {
  change: FormChange;
  data: ProductVariantUpdateData;
  disabled: boolean;
  handlers: ProductVariantUpdateHandlers;
  hasChanged: boolean;
  submit: () => void;
}

export interface ProductVariantUpdateFormProps
  extends UseProductVariantUpdateFormOpts {
  children: (props: UseProductVariantUpdateFormResult) => React.ReactNode;
  variant: ProductVariant;
  onSubmit: (data: ProductVariantUpdateSubmitData) => SubmitPromise;
}

function useProductVariantUpdateForm(
  variant: ProductVariant,
  onSubmit: (data: ProductVariantUpdateSubmitData) => SubmitPromise,
  opts: UseProductVariantUpdateFormOpts
): UseProductVariantUpdateFormResult {
  const [changed, setChanged] = React.useState(false);
  const triggerChange = () => setChanged(true);

  const attributeInput = getAttributeInputFromVariant(variant);
  const stockInput = getStockInputFromVariant(variant);
  const channelsInput = getChannelsInput(opts.currentChannels);

  const initial: ProductVariantUpdateFormData = {
    metadata: variant?.metadata?.map(mapMetadataItemToInput),
    privateMetadata: variant?.privateMetadata?.map(mapMetadataItemToInput),
    sku: variant?.sku || "",
    trackInventory: variant?.trackInventory,
    weight: variant?.weight?.value.toString() || ""
  };

  const form = useForm(initial);
  const attributes = useFormset(attributeInput);
  const attributesWithNewFileValue = useFormset<null, File>([]);
  const stocks = useFormset(stockInput);
  const channels = useFormset(channelsInput);
  const {
    isMetadataModified,
    isPrivateMetadataModified,
    makeChangeHandler: makeMetadataChangeHandler
  } = useMetadataChangeTrigger();

  const handleChange: FormChange = (event, cb) => {
    form.change(event, cb);
    triggerChange();
  };
  const changeMetadata = makeMetadataChangeHandler(handleChange);
  const handleAttributeChange = createAttributeChangeHandler(
    attributes.change,
    triggerChange
  );
  const handleAttributeMultiChange = createAttributeMultiChangeHandler(
    attributes.change,
    attributes.data,
    triggerChange
  );
  const handleAttributeReferenceChange = createAttributeReferenceChangeHandler(
    attributes.change,
    triggerChange
  );
  const handleFetchReferences = createFetchReferencesHandler(
    attributes.data,
    opts.assignReferencesAttributeId,
    opts.fetchReferencePages,
    opts.fetchReferenceProducts
  );
  const handleFetchMoreReferences = createFetchMoreReferencesHandler(
    attributes.data,
    opts.assignReferencesAttributeId,
    opts.fetchMoreReferencePages,
    opts.fetchMoreReferenceProducts
  );
  const handleAttributeFileChange = createAttributeFileChangeHandler(
    attributes.change,
    attributesWithNewFileValue.data,
    attributesWithNewFileValue.add,
    attributesWithNewFileValue.change,
    triggerChange
  );
  const handleAttributeValueReorder = createAttributeValueReorderHandler(
    attributes.change,
    attributes.data,
    triggerChange
  );

  const handleStockAdd = (id: string) => {
    triggerChange();
    stocks.add({
      data: {
        quantityAllocated:
          variant?.stocks?.find(stock => stock.warehouse.id === id)
            ?.quantityAllocated || 0
      },
      id,
      label: opts.warehouses.find(warehouse => warehouse.id === id).name,
      value: "0"
    });
  };
  const handleStockChange = (id: string, value: string) => {
    triggerChange();
    stocks.change(id, value);
  };
  const handleStockDelete = (id: string) => {
    triggerChange();
    stocks.remove(id);
  };
  const handleChannelChange: FormsetChange = (id, value) => {
    channels.change(id, value);
    triggerChange();
  };

  const dataStocks = stocks.data.map(stock => stock.id);
  const variantStocks = variant?.stocks.map(stock => stock.warehouse.id) || [];
  const stockDiff = arrayDiff(variantStocks, dataStocks);

  const addStocks = stocks.data.filter(stock =>
    stockDiff.added.some(addedStock => addedStock === stock.id)
  );
  const updateStocks = stocks.data.filter(
    stock => !stockDiff.added.some(addedStock => addedStock === stock.id)
  );

  const disabled =
    channels?.data.some(
      channelData =>
        validatePrice(channelData.value.price) ||
        validateCostPrice(channelData.value.costPrice)
    ) || !form.data.sku;
  const data: ProductVariantUpdateData = {
    ...form.data,
    attributes: getAttributesDisplayData(
      attributes.data,
      attributesWithNewFileValue.data,
      opts.referencePages,
      opts.referenceProducts
    ),
    channelListings: channels.data,
    stocks: stocks.data
  };
  const submitData: ProductVariantUpdateSubmitData = {
    ...form.data,
    ...getMetadata(form.data, isMetadataModified, isPrivateMetadataModified),
    addStocks,
    attributes: attributes.data,
    attributesWithNewFileValue: attributesWithNewFileValue.data,
    channelListings: channels.data,
    removeStocks: stockDiff.removed,
    updateStocks
  };

  const handleSubmit = async (data: ProductVariantUpdateSubmitData) => {
    const errors = await onSubmit(data);

    if (!errors?.length) {
      attributesWithNewFileValue.set([]);
    }

    return errors;
  };

  const submit = () => handleFormSubmit(submitData, handleSubmit, setChanged);

  return {
    change: handleChange,
    data,
    disabled,
    handlers: {
      addStock: handleStockAdd,
      changeChannels: handleChannelChange,
      changeMetadata,
      changeStock: handleStockChange,
      deleteStock: handleStockDelete,
      fetchMoreReferences: handleFetchMoreReferences,
      fetchReferences: handleFetchReferences,
      reorderAttributeValue: handleAttributeValueReorder,
      selectAttribute: handleAttributeChange,
      selectAttributeFile: handleAttributeFileChange,
      selectAttributeMultiple: handleAttributeMultiChange,
      selectAttributeReference: handleAttributeReferenceChange
    },
    hasChanged: changed,
    submit
  };
}

const ProductVariantUpdateForm: React.FC<ProductVariantUpdateFormProps> = ({
  children,
  variant,
  onSubmit,
  ...rest
}) => {
  const props = useProductVariantUpdateForm(variant, onSubmit, rest);

  return <form onSubmit={props.submit}>{children(props)}</form>;
};

ProductVariantUpdateForm.displayName = "ProductVariantUpdateForm";
export default ProductVariantUpdateForm;
