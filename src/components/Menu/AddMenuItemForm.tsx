
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { X, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddMenuItemFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

type FormData = {
  name: string;
  description: string;
  price: string;
  category: string;
  image_url: string;
};

const AddMenuItemForm = ({ onClose, onSuccess }: AddMenuItemFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user's restaurant_id from their profile
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('restaurant_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (!profile?.restaurant_id) throw new Error('No restaurant assigned');

      console.log('Fetched user profile:', profile);
      return profile;
    },
  });

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      price: "",
      category: "",
      image_url: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 5MB",
          variant: "destructive",
        });
        return;
      }
      
      // Check file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) return null;
    
    try {
      setIsUploading(true);
      setUploadProgress(10);
      
      // Convert file to base64
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          if (e.target?.result) {
            const base64String = e.target.result.toString().split(',')[1];
            resolve(base64String);
          } else {
            reject(new Error("Failed to convert file to base64"));
          }
        };
        reader.onerror = () => reject(reader.error);
      });
      
      reader.readAsDataURL(selectedFile);
      const base64String = await base64Promise;
      
      setUploadProgress(30);
      
      // Prepare form data for API call
      const formData = new FormData();
      formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
      formData.append('source', base64String);
      formData.append('format', 'json');
      
      setUploadProgress(50);
      
      // Make API call to freeimage.host
      const response = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData,
      });
      
      setUploadProgress(80);
      
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Image upload response:', data);
      
      setUploadProgress(100);
      
      if (data.status_code === 200 && data.image && data.image.url) {
        setUploadedImageUrl(data.image.url);
        form.setValue('image_url', data.image.url);
        toast({
          title: "Image uploaded successfully",
        });
        return data.image.url;
      } else {
        throw new Error('Invalid response from image host');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const removeImage = () => {
    setSelectedFile(null);
    setUploadedImageUrl("");
    form.setValue('image_url', "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting menu item:", data);

      if (!userProfile?.restaurant_id) {
        throw new Error('No restaurant assigned to user');
      }
      
      // If there's a selected file but not yet uploaded, upload it now
      let imageUrl = data.image_url;
      if (selectedFile && !uploadedImageUrl) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const { error } = await supabase.from("menu_items").insert([
        {
          name: data.name,
          description: data.description,
          price: parseFloat(data.price),
          category: data.category,
          image_url: imageUrl,
          restaurant_id: userProfile.restaurant_id,
          is_available: true,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Menu item added successfully",
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding menu item:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add menu item",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ["Main Course", "Appetizers", "Desserts", "Beverages", "Non-Veg", "Other"];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md relative animate-fade-in">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold mb-4">Add New Menu Item</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Item name" className="bg-gray-50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Item description" className="bg-gray-50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-gray-50">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="bg-gray-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image</FormLabel>
                  <div className="space-y-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    
                    {!selectedFile && !uploadedImageUrl && (
                      <div 
                        onClick={triggerFileInput}
                        className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 transition-colors"
                      >
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Click to upload an image</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG or GIF (max 5MB)</p>
                      </div>
                    )}
                    
                    {selectedFile && !uploadedImageUrl && (
                      <div className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {selectedFile.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeImage}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {isUploading ? (
                          <div className="space-y-2">
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-600 rounded-full transition-all duration-300" 
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-500 text-center">Uploading... {uploadProgress}%</p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={uploadImage}
                            className="w-full"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload image
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {uploadedImageUrl && (
                      <div className="border border-gray-200 rounded-md overflow-hidden">
                        <div className="relative aspect-video">
                          <img 
                            src={uploadedImageUrl} 
                            alt="Uploaded" 
                            className="object-cover w-full h-full"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={removeImage}
                            className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 p-2 bg-gray-50 truncate">
                          {uploadedImageUrl}
                        </p>
                      </div>
                    )}
                    
                    <Input
                      type="hidden"
                      {...field}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose} type="button">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || isUploading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Item"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default AddMenuItemForm;
