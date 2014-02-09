/* globals ExtensionStore, DB */
var SettingsView = (function()
{
	var SettingsView = this;
	this.addJSInclude = function(val)
	{
		var clone = $("#jsIncludeTemplate").clone();

		$(clone).val(val || "");
		$(clone).attr('id','').slideDown();

		$("#jsIncludes").append(clone);
	};
	this.addCSSInclude = function(val)
	{
		var clone = $("#cssIncludeTemplate").clone();

		$(clone).val(val || "");
		$(clone).attr('id','').slideDown();

		$("#cssIncludes").append(clone);
	};
	this.addExtension = function()
	{
		var extension = ExtensionStore.newExtension();
		this.editExtension( extension );

		ExtensionStore.saveExtension(extension);
		this.updateExtensionList();
	};
	this.updateExtensionList = function()
	{
		$("#extensionsList").empty();

		var extensions = ExtensionStore.extensions();
		for (var i = 0; i < extensions.length; i++)
		{
			var extension = extensions[i];

			this.addExtensionToList( extension );
		}

		var extension = this.extension();

		if (extension && extension.enabled)
		{
			$("#activateButton").hide();
			$("#deactivateButton").show();
		} else {
			$("#activateButton").show();
			$("#deactivateButton").hide();
		}
	};
	this.initExtensionList = function()
	{
		this.updateExtensionList();

		$(".editJS, .editHTML, .editCSS").each(function()
		{
			if ($("textarea", this).val().length > 0)
			{
				$(this).show();
			} else {
				$(this).hide();
			}
		});
	};
	this.addExtensionToList = function(extension)
	{
		var clone = $("#extensionTemplate").clone().show();
		$("li", clone).html( extension.name ).data('id', extension.id);

		$(clone).removeAttr('id').attr('ext_id', extension.id);

		var selected = this.extension();
		if (selected && selected.id === extension.id)
		{
			$(clone).addClass('active');
		}
		if (! extension.enabled)
		{
			$(clone).addClass('disabled');
		}

		$(clone).appendTo("#extensionsList");
	};
	this.export = function()
	{
		var extension = this.extension();
		var data = JSON.stringify(extension.object());

		var blob = new Blob( [ data ] , {type: "application/json"} );

		saveAs(blob, extension.name + ".json");
	};
	this.editExtension = function(extension)
	{
		if (! extension) return;

		if (this.unsaved())
		{
			if (! confirm("Are you sure you want to continue?  You have unsaved changes"))
			{
				return;
			}
		}

		$("#primaryView").addClass('hasExtension');
		$("#settings [name='id']").val( extension.id );
		$("#settings [name='name']").val( extension.name || "" );
		$("#settings [name='author']").val( extension.author || "" );
		$("#settings [name='description']").val( extension.description || "" );
		$("#settings [name='js']").val( extension.js || "" );
		$("#settings [name='css']").val( extension.css || "" );
		$("#settings [name='html']").val( extension.html || "" );
		$("#settings [name='urls']").val( extension.urls.join("\n") || "" );

		$("#jsIncludes").empty();
		$("#cssIncludes").empty();

		for (var i = 0; i < extension.includes.js.length; i++)
		{
			var includeJS = extension.includes.js[i];
			this.addJSInclude(includeJS);
		}
		for (var j = 0; j < extension.includes.css.length; j++)
		{
			var includeCSS = extension.includes.css[j];
			this.addCSSInclude(includeCSS);
		}

		this.initExtensionList();
	};
	$(document).on('click', '#extensionsList .extension', function(event)
	{
		var id = $(event.target).data('id');
		var extension = ExtensionStore.getExtension(id);
		SettingsView.editExtension(extension);
	});
	this.unsaved = function()
	{
		var edited = this.extension();
		if (! edited) return false;
		var original = ExtensionStore.getExtension( edited.id );

		for (var key in original)
		{
			if (typeof original[key] == "function") continue;

			var originalValue = JSON.stringify(original[key]);
			var editedValue = JSON.stringify(edited[key]);

			if (originalValue != editedValue)
			{
				return true;
			}
		}

		return false;
	};
	this.extension = function()
	{
		var id = $("#settings [name='id']").val();
		if (id <= 0) return null;

		var extension = jQuery.extend({}, ExtensionStore.getExtension(id));
		var keys = Object.keys(extension);
		for (var i = 0; i < keys.length; i++)
		{
			var key = keys[i];
			var element = $("#settings [name='" + key + "']");
			if (element.length === 0) continue;

			extension[key] = $(element).val();
		}
		extension.urls = $("#settings [name='urls']").val().split("\n");

		return extension;
	};
	this.enable = function()
	{
		ExtensionStore.enableExtension( this.extension() );
		this.updateExtensionList();
	};
	this.disable = function()
	{
		ExtensionStore.disableExtension( this.extension() );
		this.updateExtensionList();
	};
	this.import = function()
	{
		var extensions = $("#import").val();
		try
		{
			var json = JSON.parse( extensions );
			extensions = json;
		} catch (err) {}

		ExtensionStore.importExtensions( extensions, function()
		{
			SettingsView.updateExtensionList();

			$("#import").val("");
		});
	};
	this.delete = function()
	{
		if (confirm('Are you sure you want to delete this extension?'))
		{
			var extension = this.extension();
			ExtensionStore.deleteExtension( extension );
			this.updateExtensionList();

			$("#primaryView").removeClass('hasExtension');

			$("#settings [name='id']").val( 0 );

			noty({
				text: 'Extension Deleted',
				timeout: 5000,
				type: "success",
				buttons:[{
					addClass: 'button redButton', text: 'Undo', onClick: function($noty)
					{
						ExtensionStore.saveExtension( extension );
						SettingsView.updateExtensionList();

						$noty.close();
					}
				}]
			});
			return true;
		}
		return false;
	};
	this.save = function()
	{
		var extension = this.extension();
		if (extension)
		{
			ExtensionStore.saveExtension(extension);

			this.updateExtensionList();

			noty({
				text: 'Extension Saved!',
				timeout: 1500,
				type: "success",
				animation: {
					open: { height: 'toggle' },
					close:  {height: 'toggle' },
					easing: 'swing',
					speed: 300
				},
			});
		}
	};

	this.createEditor = function(textarea, mode)
	{
		ace.config.set("workerPath", "ace");

		var editor = ace.edit(textarea.id);
		// editor.setTheme("ace/theme/ambiance");
		editor.getSession().setMode("ace/mode/" + mode);
	}

	return this;
})();

$(function()
{
	DB.get('extensions', function()
	{
		SettingsView.initExtensionList();
	});

	jwerty.key('cmd+s/ctrl+s', ExtensionStore.save);

	SettingsView.createEditor( $(".editJS textarea").get(0) , "javascript" );
	SettingsView.createEditor( $(".editHTML textarea").get(0) , "html" );
	SettingsView.createEditor( $(".editCSS textarea").get(0) , "css" );
});