// storage.js
// Supabase-first now; this is the seam to replace with local-first later.
window.Storage={
  async requireUserId(){
    const userId=window.Auth.getUserId();
    if(!userId) throw new Error('You must be logged in.');
    return userId;
  },
  async loadEntries(){
    await this.requireUserId();
    const {data,error}=await window.supabaseClient
      .from('momentum_entries')
      .select('date,answers,updated_at')
      .order('date',{ascending:true});
    if(error) throw error;
    return data||[];
  },
  async saveEntry(date,answers){
    const userId=await this.requireUserId();
    const {data,error}=await window.supabaseClient
      .from('momentum_entries')
      .upsert({user_id:userId,date,answers},{onConflict:'user_id,date'})
      .select('date,answers,updated_at')
      .single();
    if(error) throw error;
    return data;
  },
  async deleteEntries(){
    await this.requireUserId();
    const {error}=await window.supabaseClient
      .from('momentum_entries')
      .delete()
      .neq('date','0000-00-00');
    if(error) throw error;
    return true;
  },
  async exportEntries(){return await this.loadEntries();},
  async importEntries(rows){
    const userId=await this.requireUserId();
    const normalized=(rows||[])
      .filter(row=>row&&row.date)
      .map(row=>({user_id:userId,date:row.date,answers:row.answers||{}}));
    if(!normalized.length) return [];
    const {data,error}=await window.supabaseClient
      .from('momentum_entries')
      .upsert(normalized,{onConflict:'user_id,date'})
      .select('date,answers,updated_at');
    if(error) throw error;
    return data||[];
  }
};
