/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is coded by Lukas Häring García and the
    idea is taken from some other hacking programs.
*/
const NotificationType = {
  NONE: 0,
  ERROR: 1,
  NOTIFIACTION: 2,
};

class Notification{
  constructor(_description, _type = NotificationType.NONE){
    // TODO: WIKI INFORMATION.
    this.id = Utils.uid();

    // Basic Information
    this.type = _type;
    this.description = _description;

    // Date emitted.
    this.date = new Date();
  };

  /*
    Description: Returns date of the update.
    Returns: Date Object.
  */
  getDate(){ return this.date; };

  /*
    Description: Returns UID of the notifiaction.
    Returns: String Object.
  */
  getId(){ return this.id; };

  /*
    Description: Returns HTML Format
    Returns: String Object
  */
  getHTML(){
    let minutes = Utils.pad(this.date.getMinutes().toString(), '0', 2);
    let hours = Utils.pad(this.date.getHours().toString(), '0', 2);

    let image;
    switch(this.type){
      case NotificationType.NONE: image = null; break;
      case NotificationType.ERROR: image = "cross"; break;
      case NotificationType.NOTIFIACTION: image = "bell"; break;
      default: image = "http://via.placeholder.com/75x75";
    }

    let html =
    `<div class="notification" data-uid="${ this.id }">
      <div class="notifiaction-close">&#10005;</div>`;
    if(image !== null){
      html += `<div class="notification-image">
                 <img src="./css/images/notification/${image}.png" width="75" height="75" alt="Notification" title="Notification" />
               </div>
              `;
    }
    html += `
      <div class="notification-info">
        <h6>Notification Title 2</h6>
        <p>${ this.description }</p>
        <div class="notifiaction-footer">
          <a href="#" class="notifiaction-hlink">+ Read more</a>
          <div class="notification-date">${ hours }:${ minutes }</div>
        </div>
      </div>
    </div>`;

    return html;
  };
};
