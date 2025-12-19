import mongoose ,{ Schema }from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.plugin(aggregatePaginate);


const Category = mongoose.model("Category", categorySchema);


export default Category;
